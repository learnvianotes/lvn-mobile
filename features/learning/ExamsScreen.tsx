import { useLazyQuery, useMutation, useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { ArrowLeft, Check, X } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { LoadState } from '@/features/shell/LoadState'
import { CreateExamDocument, DeleteExamDocument, ExamDocument, ExamsDocument, ExamTopicOptionsDocument, SearchDocument, UpdateExamDocument, WeakTopicsDocument, type ExamFieldsFragment } from '@/graphql/generated/graphql'
import { EXAM_LIMITS } from '@/lib/contracts/validation'
import { haptic } from '@/lib/haptics'
import { useTheme } from '@/lib/theme'
import { coreName } from './recommendationHref'
import { cn } from '@/lib/utils'

type Exam = ExamFieldsFragment
type PickedTopic = { id: string; title: string }

const pct = (v: number) => Math.round(v * 100)
const short = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
const localToday = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const daysLeftText = (days: number) => (days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`)
const field = 'border-border bg-card text-foreground rounded-xl border px-3 py-2.5 text-base'

function Header({ title }: { title: string }) {
  const insets = useSafeAreaInsets()
  const fg = String(useCSSVariable('--color-foreground') ?? '#152033')
  return (
    <View className="flex-row items-center gap-2 px-3 pb-2" style={{ paddingTop: insets.top + 6 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} className="size-10 items-center justify-center rounded-full">
        <ArrowLeft size={22} color={fg} />
      </Pressable>
      <Text className="text-lg font-bold" accessibilityRole="header">
        {title}
      </Text>
    </View>
  )
}

/** Readiness as a bar, with a mark where the target line is today. */
function ReadinessBar({ readiness, targetToday }: { readiness: number; targetToday: number }) {
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={`Readiness: ${readiness}%, target today ${targetToday}%`} accessibilityValue={{ min: 0, max: 100, now: readiness }} className="bg-muted h-2.5 flex-1 rounded-full">
      <View className="bg-primary h-full rounded-full" style={{ width: `${readiness}%` }} />
      <View className="bg-foreground/60 absolute -top-1 h-4.5 w-0.5 rounded" style={{ left: `${targetToday}%` }} />
    </View>
  )
}

type Tab = 'upcoming' | 'plan' | 'progress' | 'notes'
const TABS: { tab: Tab; label: string }[] = [
  { tab: 'upcoming', label: 'Upcoming' },
  { tab: 'plan', label: 'Study Plan' },
  { tab: 'progress', label: 'Progress' },
  { tab: 'notes', label: 'Notes' },
]
/** Where a plan's topic leads: its notes in Explore, or a core subject's topic by name (lvn-backend ADR-0076). */
const openTopic = (tp: { key: string; title: string }) =>
  router.push(tp.key.startsWith('topic:') ? { pathname: '/explore', params: { topic: tp.key.slice(6), topicTitle: tp.title } } : { pathname: '/explore', params: { q: tp.title || coreName(tp.key) } })

/**
 * Exams on the phone (lvn-backend ADR-0070, ADR-0076) in tabs: Upcoming (each exam's Readiness against the target line,
 * and adding one), Study Plan (today's sessions as a checklist and Continue plan), Progress (Readiness, the topics'
 * mastery and the weak topics) and Notes (notes on an exam's topics). A task left is never framed as a loss.
 */
export function ExamsScreen() {
  const insets = useSafeAreaInsets()
  const list = useQuery(ExamsDocument, { fetchPolicy: 'cache-and-network' })
  const { data } = list
  const [adding, setAdding] = useState(false)
  const [tab, setTab] = useState<Tab>('upcoming')
  const exams = data?.exams
  const upcoming = exams?.filter((e) => !e.past) ?? []
  return (
    <View className="bg-background flex-1">
      <Header title="Exams" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
        <Text className="text-muted-foreground text-sm">Add an exam and its topics: LearnViaNotes spreads revision sessions back from the day, and Readiness shows how well you know the topics now.</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" contentContainerStyle={{ gap: 8 }}>
          {TABS.map((x) => (
            <Pressable key={x.tab} accessibilityRole="tab" accessibilityState={{ selected: x.tab === tab }} onPress={() => setTab(x.tab)} className={`rounded-full px-4 py-2 ${x.tab === tab ? 'bg-primary' : 'bg-card border-border border'}`}>
              <Text className={x.tab === tab ? 'text-primary-foreground font-semibold' : 'font-semibold'}>{x.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <LoadState query={list} message="Your exams could not load." />
        {tab === 'upcoming' ? (
          <>
            {adding ? (
              <View className="bg-card border-border rounded-2xl border p-4">
                <ExamForm onDone={() => setAdding(false)} />
              </View>
            ) : (
              <Pressable accessibilityRole="button" onPress={() => setAdding(true)} className="bg-primary self-start rounded-xl px-4 py-2.5">
                <Text className="text-primary-foreground font-semibold">Add an exam</Text>
              </Pressable>
            )}
            {exams && !exams.length ? <Text className="text-muted-foreground text-center">No exams yet. Add one and its plan appears here.</Text> : null}
            {exams?.map((e) => (
              <ExamCard key={e.id} exam={e} />
            ))}
          </>
        ) : null}
        {exams && tab !== 'upcoming' && !upcoming.length ? (
          <View className="border-border items-center gap-3 rounded-2xl border border-dashed p-5">
            <Text className="text-muted-foreground text-center">No exam coming up. Add one and its plan, progress and notes appear here.</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setTab('upcoming')
                setAdding(true)
              }}
              className="bg-primary rounded-xl px-4 py-2.5"
            >
              <Text className="text-primary-foreground font-semibold">Add an exam</Text>
            </Pressable>
          </View>
        ) : null}
        {tab === 'plan' && upcoming.length ? <StudyPlan exams={upcoming} /> : null}
        {tab === 'progress' && upcoming.length ? (
          <>
            {upcoming.map((e) => (
              <View key={e.id} className="bg-card border-border gap-3 rounded-2xl border p-4">
                <Text className="text-lg font-bold" accessibilityRole="header">
                  {e.name}
                </Text>
                <View className="flex-row items-center gap-3">
                  <Text className="w-28 text-sm font-semibold">Readiness {e.readiness}%</Text>
                  <ReadinessBar readiness={e.readiness} targetToday={e.targetToday} />
                </View>
                <TopicMastery exam={e} />
              </View>
            ))}
            <WeakTopics />
          </>
        ) : null}
        {tab === 'notes' && upcoming.length ? <ExamNotes exams={upcoming} /> : null}
      </ScrollView>
    </View>
  )
}

/**
 * Today's sessions as a checklist (lvn-backend ADR-0076). A session is done by studying its topics (ADR-0070), so each
 * line shows whether it is and leads to its topics; Continue plan opens the first topic still to study today.
 */
function StudyPlan({ exams }: { exams: Exam[] }) {
  const onBrand = useTheme().palette.brandForeground
  const today = exams.flatMap((e) => e.tasks.filter((x) => x.today).map((task) => ({ exam: e, task })))
  const next = today.find((x) => !x.task.done && x.task.topics.length)
  return (
    <>
      <View className="bg-card border-border gap-3 rounded-2xl border p-4">
        <View className="flex-row items-center justify-between gap-3">
          <Text className="flex-1 text-lg font-bold" accessibilityRole="header">
            Today
          </Text>
          {next ? (
            <Pressable accessibilityRole="button" onPress={() => openTopic(next.task.topics[0]!)} className="bg-primary rounded-xl px-4 py-2">
              <Text className="text-primary-foreground font-semibold">Continue plan</Text>
            </Pressable>
          ) : null}
        </View>
        <Text className="text-muted-foreground text-sm">{today.length ? (next ? 'A session is done by 10 minutes on its topics that day, or a quiz on them.' : 'Today’s revision is done') : 'No session planned today.'}</Text>
        {today.map(({ exam, task }) => (
          <View key={task.id} className={cn('flex-row items-start gap-3 rounded-xl px-3 py-2', task.done ? 'bg-primary/10' : 'bg-muted')}>
            <View accessible accessibilityLabel={task.done ? 'done' : 'to do'} className={cn('mt-0.5 size-5 items-center justify-center rounded-full', task.done ? 'bg-primary' : 'border-border border')}>
              {task.done ? <Check size={12} color={onBrand} /> : null}
            </View>
            <View className="flex-1 gap-1">
              <Text className="font-medium">{exam.name}</Text>
              <View className="flex-row flex-wrap gap-x-3 gap-y-1">
                {task.topics.map((tp) => (
                  <Pressable key={tp.key} accessibilityRole="link" accessibilityLabel={`Study ${tp.title || coreName(tp.key)}`} onPress={() => openTopic(tp)}>
                    <Text className="text-primary text-sm font-semibold">{tp.title || coreName(tp.key)}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        ))}
      </View>
      {exams.map((e) => (
        <Pressable key={e.id} accessibilityRole="link" onPress={() => router.push(`/exams/${e.id}`)}>
          <Text className="text-primary text-sm font-semibold">The whole plan for {e.name}</Text>
        </Pressable>
      ))}
    </>
  )
}

/** Notes on an exam's topics: one's own, shared and public, newest first (lvn-backend ADR-0076). */
function ExamNotes({ exams }: { exams: Exam[] }) {
  const [examId, setExamId] = useState(exams[0]!.id)
  const exam = exams.find((e) => e.id === examId) ?? exams[0]!
  const topicIds = exam.topics.flatMap((tp) => (tp.key.startsWith('topic:') ? [tp.key.slice(6)] : [])).slice(0, 20)
  const { data, fetchMore } = useQuery(SearchDocument, { variables: { query: '', scopes: ['NOTES'], filters: { topicIds } }, skip: !topicIds.length })
  const found = data?.search
  const notes = found?.notes ?? []
  return (
    <View className="gap-3">
      {exams.length > 1 ? (
        <View className="flex-row flex-wrap gap-2">
          {exams.map((e) => (
            <Pressable
              key={e.id}
              accessibilityRole="button"
              accessibilityState={{ selected: e.id === exam.id }}
              onPress={() => setExamId(e.id)}
              className={`rounded-full px-3 py-1.5 ${e.id === exam.id ? 'bg-primary' : 'border-border border'}`}
            >
              <Text className={e.id === exam.id ? 'text-primary-foreground text-xs font-semibold' : 'text-xs font-semibold'}>{e.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Text className="text-muted-foreground text-sm">Notes on the topics of {exam.name}: yours, those shared with you and public ones, newest first.</Text>
      {!topicIds.length || (found && !notes.length) ? (
        <View className="border-border items-center gap-2 rounded-2xl border border-dashed p-5">
          <Text className="text-muted-foreground text-center">No notes on these topics yet.</Text>
          <Pressable accessibilityRole="link" onPress={() => router.push('/explore')}>
            <Text className="text-primary text-sm font-semibold">Search notes</Text>
          </Pressable>
        </View>
      ) : null}
      {notes.map(({ note }) => (
        <Pressable key={note.id} accessibilityRole="link" accessibilityLabel={note.title || 'Untitled note'} onPress={() => router.push(`/notes/${note.id}`)} className="bg-card border-border gap-0.5 rounded-2xl border px-4 py-3">
          <Text className="font-semibold">{note.title || 'Untitled note'}</Text>
          <Text className="text-muted-foreground text-xs">by {note.owner.displayName}</Text>
        </Pressable>
      ))}
      {found?.notesCursor ? (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            void fetchMore({
              variables: { after: found.notesCursor },
              updateQuery: (prev, { fetchMoreResult }) => ({ search: { ...prev.search, notes: [...prev.search.notes, ...fetchMoreResult.search.notes], notesCursor: fetchMoreResult.search.notesCursor } }),
            })
          }
          className="border-border self-center rounded-full border px-4 py-2"
        >
          <Text className="text-sm font-semibold">More notes</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

/** Each topic's mastery, with the recall and quiz accuracy behind it (lvn-backend ADR-0070). */
function TopicMastery({ exam }: { exam: Exam }) {
  return (
    <>
      {exam.topics.map((tp) => (
        <View key={tp.key} className="gap-1">
          <Text className="font-medium">{tp.title}</Text>
          <Text className="text-muted-foreground text-sm">
            {tp.recall === null && tp.accuracy === null ? 'No flashcards or quizzes yet' : [tp.recall !== null ? `Recall ${pct(tp.recall)}%` : null, tp.accuracy !== null ? `Accuracy ${pct(tp.accuracy)}%` : null].filter(Boolean).join(' · ')}
          </Text>
          <View className="bg-muted h-1.5 rounded-full">
            <View className="bg-primary/70 h-full rounded-full" style={{ width: `${pct(tp.mastery)}%` }} />
          </View>
        </View>
      ))}
    </>
  )
}

function ExamCard({ exam }: { exam: Exam }) {
  const today = exam.tasks.filter((x) => x.today)
  const behind = exam.targetToday - exam.readiness
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={exam.name} onPress={() => router.push(`/exams/${exam.id}`)} className="bg-card border-border gap-2 rounded-2xl border p-4">
      <View className="flex-row items-baseline justify-between gap-2">
        <Text className="flex-1 text-lg font-bold" numberOfLines={1}>
          {exam.name}
        </Text>
        <Text className="text-muted-foreground text-sm">{exam.past ? 'Done' : daysLeftText(exam.daysLeft)}</Text>
      </View>
      <View className="flex-row items-center gap-3">
        <Text className="w-28 text-sm font-semibold">Readiness {exam.readiness}%</Text>
        <ReadinessBar readiness={exam.readiness} targetToday={exam.targetToday} />
      </View>
      {!exam.past ? <Text className="text-muted-foreground text-sm">{behind > 0 ? `${behind} points below today’s target` : 'On track'}</Text> : null}
      {today.length ? (
        <Text className={cn('text-sm', today.every((x) => x.done) && 'text-primary')}>
          {today.every((x) => x.done) ? 'Today’s revision is done' : `Today: ${today.flatMap((x) => x.topics.map((tp) => tp.title)).join(', ')}`}
        </Text>
      ) : null}
    </Pressable>
  )
}

/** One exam: Readiness, its topics' mastery and the plan; edit and delete. */
export function ExamScreen({ id }: { id: string }) {
  const insets = useSafeAreaInsets()
  const primaryFg = String(useCSSVariable('--color-primary-foreground') ?? '#ffffff')
  const one = useQuery(ExamDocument, { variables: { id }, fetchPolicy: 'cache-and-network' })
  const { data } = one
  const [remove] = useMutation(DeleteExamDocument, { refetchQueries: [ExamsDocument] })
  const [editing, setEditing] = useState(false)
  const exam = data?.exam
  return (
    <View className="bg-background flex-1">
      <Header title={exam?.name ?? 'Exam'} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
        {/* What failed comes first: only an answer without the exam means it is not there. */}
        {!data ? <LoadState query={one} message="This exam could not load." /> : !exam ? <Text className="text-muted-foreground">That exam is not there.</Text> : null}
        {exam ? (
          <>
            <Text className="text-muted-foreground text-sm">
              {new Date(`${exam.date}T12:00:00Z`).toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })} · {exam.past ? 'Done' : daysLeftText(exam.daysLeft)}
            </Text>
            <View className="flex-row items-center gap-3">
              <Text className="w-28 text-sm font-semibold">Readiness {exam.readiness}%</Text>
              <ReadinessBar readiness={exam.readiness} targetToday={exam.targetToday} />
            </View>
            <View className="flex-row gap-2">
              <Pressable accessibilityRole="button" onPress={() => setEditing((v) => !v)} className="border-border rounded-xl border px-4 py-2">
                <Text className="font-semibold">Edit</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  Alert.alert('Delete the exam?', `${exam.name} and its plan go.`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => void remove({ variables: { input: { id: exam.id } } }).then(() => router.back()) },
                  ])
                }
                className="rounded-xl px-4 py-2"
              >
                <Text className="text-muted-foreground font-semibold">Delete the exam</Text>
              </Pressable>
            </View>
            {editing ? (
              <View className="bg-card border-border rounded-2xl border p-4">
                <ExamForm exam={exam} onDone={() => setEditing(false)} />
              </View>
            ) : null}
            <View className="bg-card border-border gap-3 rounded-2xl border p-4">
              <Text className="text-lg font-bold" accessibilityRole="header">
                Topics
              </Text>
              <Text className="text-muted-foreground text-sm">Recall is how likely you are to remember a topic’s flashcards now; accuracy is your last quiz answers on it.</Text>
              <TopicMastery exam={exam} />
            </View>
            <View className="bg-card border-border gap-2 rounded-2xl border p-4">
              <Text className="text-lg font-bold" accessibilityRole="header">
                Revision plan
              </Text>
              <Text className="text-muted-foreground text-sm">A session is done by 10 minutes on its topics that day, or a quiz on them.</Text>
              {!exam.tasks.length ? <Text className="text-muted-foreground text-sm">No sessions: the exam is today.</Text> : null}
              {exam.tasks.map((task) => {
                const status = task.done ? 'done' : task.today ? 'today' : task.day > localToday() ? 'to come' : 'not done'
                const topics = task.topics.map((x) => x.title).join(', ')
                return (
                  <View key={task.id} accessible accessibilityLabel={`${short(task.day)}: ${topics}, ${status}`} className={cn('flex-row items-center gap-3 rounded-xl px-3 py-2', task.today ? 'bg-secondary' : 'bg-muted')}>
                    <View className={cn('size-6 items-center justify-center rounded-full', task.done ? 'bg-primary' : 'border-border border')}>{task.done ? <Check size={13} color={primaryFg} /> : null}</View>
                    <Text className="text-muted-foreground w-24 text-sm">{short(task.day)}</Text>
                    <Text className="flex-1 text-sm">{topics}</Text>
                  </View>
                )
              })}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  )
}

/** Add an exam, or change one: name, how many days away, and topics. */
function ExamForm({ exam, onDone }: { exam?: Exam; onDone: () => void }) {
  const [name, setName] = useState(exam?.name ?? '')
  const [date, setDate] = useState(exam?.date ?? addDays(localToday(), 14))
  const [topics, setTopics] = useState<PickedTopic[]>(exam?.topics.flatMap((x) => (x.key.startsWith('topic:') ? [{ id: x.key.slice(6), title: x.title }] : [])) ?? [])
  const [problem, setProblem] = useState<string | null>(null)
  const [create, creating] = useMutation(CreateExamDocument, { refetchQueries: [ExamsDocument, WeakTopicsDocument] })
  const [update, updating] = useMutation(UpdateExamDocument, { refetchQueries: [ExamsDocument, WeakTopicsDocument] })
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#3d4b63')
  const move = (n: number) => setDate((d) => (addDays(d, n) < localToday() ? localToday() : addDays(d, n)))
  return (
    <View className="gap-3">
      <TextInput accessibilityLabel="Exam" placeholder="e.g. Operating Systems midterm" placeholderTextColor={muted} maxLength={EXAM_LIMITS.name} value={name} onChangeText={setName} className={field} />
      <View className="flex-row items-center gap-3">
        <Pressable accessibilityRole="button" accessibilityLabel="A day earlier" onPress={() => move(-1)} className="border-border size-10 items-center justify-center rounded-full border">
          <Text className="text-lg font-bold">−</Text>
        </Pressable>
        <Text className="flex-1 text-center text-sm font-semibold" accessibilityLiveRegion="polite">
          {short(date)}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="A day later" onPress={() => move(1)} className="border-border size-10 items-center justify-center rounded-full border">
          <Text className="text-lg font-bold">+</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="A week later" onPress={() => move(7)} className="border-border rounded-full border px-3 py-2">
          <Text className="text-sm font-semibold">+7</Text>
        </Pressable>
      </View>
      <TopicPicker picked={topics} onChange={setTopics} />
      {problem ? <Text className="text-destructive text-sm">{problem}</Text> : null}
      <View className="flex-row gap-2">
        <Pressable
          accessibilityRole="button"
          disabled={creating.loading || updating.loading || !topics.length}
          onPress={async () => {
            setProblem(null)
            const input = { name, date, topicIds: topics.map((x) => x.id) }
            const message = exam
              ? (await update({ variables: { input: { id: exam.id, ...input } } })).data?.updateExam.userErrors[0]?.message
              : (await create({ variables: { input } })).data?.createExam.userErrors[0]?.message
            if (message) setProblem(message)
            else (haptic.success(), onDone())
          }}
          className={cn('bg-primary rounded-xl px-4 py-2.5', !topics.length && 'opacity-50')}
        >
          <Text className="text-primary-foreground font-semibold">{exam ? 'Save' : 'Add the exam'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onDone} className="rounded-xl px-4 py-2.5">
          <Text className="font-semibold">Cancel</Text>
        </Pressable>
      </View>
    </View>
  )
}

function TopicPicker({ picked, onChange }: { picked: PickedTopic[]; onChange: (topics: PickedTopic[]) => void }) {
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#3d4b63')
  const [query, setQuery] = useState('')
  const [find, found] = useLazyQuery(ExamTopicOptionsDocument)
  useEffect(() => {
    if (query.trim().length < 2) return
    const timer = setTimeout(() => void find({ variables: { query: query.trim() } }), 250)
    return () => clearTimeout(timer)
  }, [query, find])
  const options = query.trim().length >= 2 ? (found.data?.examTopicOptions ?? []).filter((o) => !picked.some((p) => p.id === o.id)) : []
  return (
    <View className="gap-2">
      <Text className="text-sm font-medium">Topics</Text>
      <View className="flex-row flex-wrap gap-2">
        {picked.map((p) => (
          <View key={p.id} className="bg-secondary flex-row items-center gap-1 rounded-full py-1 pl-3 pr-1">
            <Text className="text-primary text-sm">{p.title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${p.title}`} onPress={() => onChange(picked.filter((x) => x.id !== p.id))} className="rounded-full p-1">
              <X size={14} color={muted} />
            </Pressable>
          </View>
        ))}
      </View>
      {picked.length < EXAM_LIMITS.topics ? (
        <>
          <TextInput accessibilityLabel="Find a topic" placeholder="Find a topic" placeholderTextColor={muted} value={query} onChangeText={setQuery} autoCapitalize="none" className={field} />
          {query.trim().length >= 2 && found.data && !options.length ? <Text className="text-muted-foreground text-sm">No topic matches.</Text> : null}
          {options.slice(0, 8).map((o) => (
            <Pressable
              key={o.id}
              accessibilityRole="button"
              accessibilityLabel={`Add ${o.title}`}
              onPress={() => {
                haptic.tick()
                onChange([...picked, { id: o.id, title: o.title }])
                setQuery('')
              }}
              className="bg-muted flex-row items-baseline justify-between gap-2 rounded-xl px-3 py-2.5"
            >
              <Text className="text-sm">{o.title}</Text>
              <Text className="text-muted-foreground text-xs">{o.subjectTitle}</Text>
            </Pressable>
          ))}
        </>
      ) : null}
    </View>
  )
}

/** Weak topics to revise first, each with why. */
function WeakTopics() {
  const { data } = useQuery(WeakTopicsDocument, { fetchPolicy: 'cache-and-network' })
  const weak = data?.weakTopics
  if (!weak) return null
  return (
    <View className="bg-card border-border gap-2 rounded-2xl border p-4">
      <Text className="text-lg font-bold" accessibilityRole="header">
        Weak topics
      </Text>
      <Text className="text-muted-foreground text-sm">{weak.length ? 'Topics to revise first.' : 'No weak topics. Well done.'}</Text>
      {weak.map((w) => (
        <View key={w.key} className="bg-muted rounded-xl px-3 py-2">
          <Text className="font-medium">{w.title ?? w.key.replace(/^core:/, '').replace('/', ' / ').replace(/-/g, ' ')}</Text>
          <Text className="text-muted-foreground text-sm">{w.reason === 'LOW_ACCURACY' ? `Under 60% right in your last quizzes (${pct(w.accuracy ?? 0)}%)` : `Not revised in 14 days, before ${w.examName ?? 'an exam'}`}</Text>
        </View>
      ))}
    </View>
  )
}
