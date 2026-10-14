import { useLazyQuery, useMutation, useQuery } from '@apollo/client/react'
import { Check } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { Pressable, TextInput, View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { AddWeeklyTaskDocument, ExamTopicOptionsDocument, RemoveWeeklyTaskDocument, TaskSuggestionsDocument, UpdateWeeklyTaskDocument, WeeklyTasksDocument, type WeeklyTaskFieldsFragment, type WeeklyTaskKind } from '@/graphql/generated/graphql'

const KINDS: { kind: WeeklyTaskKind; label: string; start: number }[] = [
  { kind: 'REVIEWS', label: 'Review flashcards', start: 50 },
  { kind: 'QUIZ_ANSWERS', label: 'Answer questions', start: 20 },
  { kind: 'TOPIC_MINUTES', label: 'Minutes on a topic', start: 60 },
]
const refetchQueries = [WeeklyTasksDocument, TaskSuggestionsDocument]

/** A task in words: "Review 50 flashcards", "Answer 20 questions on Graphs", "Spend 60 minutes on Heaps". */
export function taskLabel(t: { kind: WeeklyTaskKind; target: number; topicTitle?: string | null }): string {
  if (t.kind === 'REVIEWS') return `Review ${t.target} flashcards`
  if (t.kind === 'QUIZ_ANSWERS') return t.topicTitle ? `Answer ${t.target} questions on ${t.topicTitle}` : `Answer ${t.target} questions`
  return `Spend ${t.target} minutes on ${t.topicTitle ?? 'a topic'}`
}

/**
 * This week's tasks on the phone (lvn-backend ADR-0081): up to three goals the person picks, often from suggestions,
 * each with how far it has come and the plan they wrote; an unfinished one just ends with the week.
 */
export function WeeklyTasks() {
  const { data } = useQuery(WeeklyTasksDocument, { fetchPolicy: 'cache-and-network' })
  const [adding, setAdding] = useState(false)
  const week = data?.weeklyTasks
  if (!week) return null
  const done = week.tasks.filter((x) => x.done).length
  return (
    <View className="bg-card border-border gap-3 rounded-2xl border p-4">
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 text-lg font-bold" accessibilityRole="header">
          This week’s tasks
        </Text>
        {week.tasks.length ? <Text className="text-muted-foreground text-sm">{`${done} of ${week.tasks.length} done`}</Text> : null}
      </View>
      {!week.tasks.length ? <Text className="text-muted-foreground text-sm">Pick up to three things to do this week. A plan for when and where makes them likelier to happen.</Text> : null}
      {week.tasks.map((task) => (
        <TaskRow key={task.id} task={task} />
      ))}
      {week.tasks.length < week.max ? (
        adding ? (
          <AddTask onClose={() => setAdding(false)} />
        ) : (
          <Pressable accessibilityRole="button" onPress={() => setAdding(true)} className="border-border self-start rounded-xl border px-4 py-2.5">
            <Text className="font-semibold">Add a task</Text>
          </Pressable>
        )
      ) : (
        <Text className="text-muted-foreground text-xs">That’s {week.max} tasks for this week.</Text>
      )}
    </View>
  )
}

function TaskRow({ task }: { task: WeeklyTaskFieldsFragment }) {
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  const [editing, setEditing] = useState(false)
  const [target, setTarget] = useState(String(task.target))
  const [plan, setPlan] = useState(task.plan ?? '')
  const [problem, setProblem] = useState<string | null>(null)
  const [update, updating] = useMutation(UpdateWeeklyTaskDocument, { refetchQueries })
  const [remove, removing] = useMutation(RemoveWeeklyTaskDocument, { refetchQueries })
  const label = taskLabel(task)
  const shown = Math.min(task.progress, task.target)
  return (
    <View className="bg-muted gap-2 rounded-xl p-3">
      <View className="flex-row items-center gap-2">
        {task.done ? (
          <View className="bg-primary size-6 items-center justify-center rounded-full" accessibilityLabel="Done">
            <Check size={14} color="#ffffff" />
          </View>
        ) : null}
        <Text className="flex-1 font-semibold">{label}</Text>
        <Text className="text-muted-foreground text-sm">{`${shown} / ${task.target}`}</Text>
      </View>
      <View className="bg-background h-2 rounded-full" accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: task.target, now: shown }}>
        <View className="bg-primary h-full rounded-full" style={{ width: `${Math.round((shown / task.target) * 100)}%` }} />
      </View>
      {task.plan && !editing ? <Text className="text-muted-foreground text-sm">Plan: {task.plan}</Text> : null}
      {editing ? (
        <View className="gap-2">
          <TextInput accessibilityLabel="Target" value={target} onChangeText={setTarget} keyboardType="number-pad" className="border-border text-foreground bg-background rounded-xl border px-3 py-2" />
          <TextInput accessibilityLabel="When and where" value={plan} onChangeText={setPlan} maxLength={140} placeholder="After lunch, in the library" placeholderTextColor={muted} className="border-border text-foreground bg-background rounded-xl border px-3 py-2" />
          {problem ? (
            <Text accessibilityRole="alert" className="text-destructive text-sm">
              {problem}
            </Text>
          ) : null}
          <View className="flex-row gap-2">
            <Pressable
              accessibilityRole="button"
              disabled={updating.loading}
              onPress={async () => {
                const res = await update({ variables: { input: { id: task.id, target: Number(target), plan } } }).catch(() => null)
                const why = res?.data?.updateWeeklyTask.userErrors[0]?.message ?? (res ? null : 'That didn’t work. Try again.')
                setProblem(why)
                if (!why) setEditing(false)
              }}
              className="bg-primary rounded-xl px-4 py-2"
            >
              <Text className="text-primary-foreground font-semibold">Save</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setEditing(false)} className="rounded-xl px-4 py-2">
              <Text className="font-semibold">Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View className="flex-row gap-4">
          <Pressable accessibilityRole="button" accessibilityLabel={`Change the task ${label}`} onPress={() => setEditing(true)}>
            <Text className="text-primary text-sm font-semibold">Change</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove the task ${label}`} disabled={removing.loading} onPress={() => void remove({ variables: { id: task.id } })}>
            <Text className="text-muted-foreground text-sm font-semibold">Remove</Text>
          </Pressable>
        </View>
      )}
    </View>
  )
}

function AddTask({ onClose }: { onClose: () => void }) {
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  const suggestions = useQuery(TaskSuggestionsDocument, { fetchPolicy: 'cache-and-network' }).data?.taskSuggestions ?? []
  const [kind, setKind] = useState<WeeklyTaskKind>('REVIEWS')
  const [target, setTarget] = useState('50')
  const [topic, setTopic] = useState<{ id: string; title: string } | null>(null)
  const [query, setQuery] = useState('')
  const [plan, setPlan] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [find, found] = useLazyQuery(ExamTopicOptionsDocument)
  const [add, adding] = useMutation(AddWeeklyTaskDocument, { refetchQueries })
  useEffect(() => {
    if (query.trim().length < 2) return
    const timer = setTimeout(() => void find({ variables: { query: query.trim() } }), 250)
    return () => clearTimeout(timer)
  }, [query, find])
  const submit = async (input: { kind: WeeklyTaskKind; target: number; topicId: string | null }) => {
    const res = await add({ variables: { input: { ...input, plan: plan.trim() || null } } }).catch(() => null)
    const why = res?.data?.addWeeklyTask.userErrors[0]?.message ?? (res ? null : 'That didn’t work. Try again.')
    setProblem(why)
    if (!why) onClose()
  }
  const options = query.trim().length >= 2 ? (found.data?.examTopicOptions ?? []) : []
  return (
    <View className="border-border gap-3 rounded-xl border p-3">
      {suggestions.length ? <Text className="text-sm font-semibold">Suggested for this week</Text> : null}
      {suggestions.map((s) => (
        <View key={`${s.kind}:${s.topicId ?? ''}`} className="bg-muted flex-row items-center gap-2 rounded-xl p-3">
          <View className="flex-1 gap-0.5">
            <Text className="font-semibold">{taskLabel(s)}</Text>
            <Text className="text-muted-foreground text-xs">{s.why}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Add the task ${taskLabel(s)}`} disabled={adding.loading} onPress={() => void submit({ kind: s.kind, target: s.target, topicId: s.topicId ?? null })} className="bg-primary rounded-xl px-3 py-2">
            <Text className="text-primary-foreground font-semibold">Add</Text>
          </Pressable>
        </View>
      ))}
      <Text className="text-sm font-semibold">{suggestions.length ? 'Or something else' : 'A task for this week'}</Text>
      <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
        {KINDS.map((k) => (
          <Pressable
            key={k.kind}
            accessibilityRole="radio"
            accessibilityState={{ checked: kind === k.kind }}
            onPress={() => (setKind(k.kind), setTarget(String(k.start)))}
            className={`rounded-full px-3 py-1.5 ${kind === k.kind ? 'bg-primary' : 'border-border border'}`}
          >
            <Text className={kind === k.kind ? 'text-primary-foreground text-sm font-semibold' : 'text-sm'}>{k.label}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput accessibilityLabel="Target" value={target} onChangeText={setTarget} keyboardType="number-pad" className="border-border text-foreground rounded-xl border px-3 py-2" />
      {kind !== 'REVIEWS' ? (
        topic ? (
          <View className="flex-row items-center gap-2">
            <Text className="flex-1 text-sm">On {topic.title}</Text>
            <Pressable accessibilityRole="button" onPress={() => setTopic(null)}>
              <Text className="text-primary text-sm font-semibold">Change topic</Text>
            </Pressable>
          </View>
        ) : (
          <View className="gap-1">
            <TextInput accessibilityLabel="Topic" value={query} onChangeText={setQuery} placeholder="Find a topic" placeholderTextColor={muted} className="border-border text-foreground rounded-xl border px-3 py-2" />
            {options.slice(0, 5).map((o) => (
              <Pressable key={o.id} accessibilityRole="button" accessibilityLabel={`Choose ${o.title}`} onPress={() => (setTopic({ id: o.id, title: o.title }), setQuery(''))} className="rounded-lg px-2 py-2">
                <Text className="text-sm">{o.title}</Text>
              </Pressable>
            ))}
          </View>
        )
      ) : null}
      <TextInput accessibilityLabel="When and where (optional)" value={plan} onChangeText={setPlan} maxLength={140} placeholder="After lunch, in the library" placeholderTextColor={muted} className="border-border text-foreground rounded-xl border px-3 py-2" />
      {problem ? (
        <Text accessibilityRole="alert" className="text-destructive text-sm">
          {problem}
        </Text>
      ) : null}
      <View className="flex-row gap-2">
        <Pressable accessibilityRole="button" disabled={adding.loading} onPress={() => void submit({ kind, target: Number(target), topicId: topic?.id ?? null })} className="bg-primary rounded-xl px-4 py-2.5">
          <Text className="text-primary-foreground font-semibold">Add the task</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onClose} className="rounded-xl px-4 py-2.5">
          <Text className="font-semibold">Cancel</Text>
        </Pressable>
      </View>
    </View>
  )
}
