import { useMutation, useQuery } from '@apollo/client/react'
import { router, useLocalSearchParams } from 'expo-router'
import { ArrowLeft, Check, X } from 'lucide-react-native'
import { useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, Switch, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { LoadState } from '@/features/shell/LoadState'
import { AnswerContestQuestionDocument, ContestDocument, SetContestBandsDocument, StartContestDocument, SubmitContestDocument, type ContestAttemptFieldsFragment } from '@/graphql/generated/graphql'

const BAND = { TOP_10: 'You’re in the top 10% of adults who took it.', TOP_25: 'You’re in the top 25% of adults who took it.', TOP_50: 'You’re in the top half of adults who took it.' } as const

/**
 * A weekly contest on the phone (lvn-backend ADR-0082): Start while it is open; the attempt with the time left (kept by
 * the server) and answers that can change until it ends or is submitted; then the score, the person's best, every
 * question with the right answer and why, and, for an adult who asked, their band among adults.
 */
export function ContestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const fg = String(useCSSVariable('--color-foreground') ?? '#1c1b18')
  const query = useQuery(ContestDocument, { variables: { id: String(id) }, fetchPolicy: 'cache-and-network' })
  const { data, refetch } = query
  const [start, starting] = useMutation(StartContestDocument)
  const [problem, setProblem] = useState<string | null>(null)
  const c = data?.contest
  const a = c?.viewerAttempt
  return (
    <View className="bg-background flex-1">
      <View className="flex-row items-center gap-2 px-3 pb-2" style={{ paddingTop: insets.top + 6 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/contests'))} className="size-10 items-center justify-center rounded-full">
          <ArrowLeft size={22} color={fg} />
        </Pressable>
        <Text className="flex-1 text-lg font-semibold" accessibilityRole="header" numberOfLines={1}>
          {c?.title ?? 'Contest'}
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 32 }}>
        {/* What failed comes first: only an answer without the contest means it is not here. */}
        {!data ? <LoadState query={query} message="This contest could not load." /> : !c ? <Text className="text-muted-foreground">That contest is not here.</Text> : null}
        {c ? <Text className="text-muted-foreground text-sm">{[c.subjectTitle, `${c.questionCount} questions`, `${c.minutes} minutes`].filter(Boolean).join(' · ')}</Text> : null}
        {c && !a ? (
          c.state === 'OPEN' ? (
            <View className="bg-card border-border gap-3 rounded-2xl border p-4">
              <Text className="text-sm">One attempt. Once you start, you have {c.minutes} minutes. You can change answers until the time is up or you submit; then every answer is explained.</Text>
              <Pressable
                accessibilityRole="button"
                disabled={starting.loading}
                onPress={async () => {
                  const res = await start({ variables: { contestId: c.id } }).catch(() => null)
                  setProblem(res?.data?.startContest.userErrors[0]?.message ?? (res ? null : 'That didn’t work. Try again.'))
                  await refetch()
                }}
                className="bg-primary self-start rounded-xl px-5 py-2.5"
              >
                <Text className="text-primary-foreground font-semibold">Start</Text>
              </Pressable>
              {problem ? (
                <Text accessibilityRole="alert" className="text-destructive text-sm">
                  {problem}
                </Text>
              ) : null}
            </View>
          ) : (
            <Text className="text-muted-foreground text-sm">{c.state === 'UPCOMING' ? `Opens ${new Date(c.opensAt).toLocaleString('en-IN', { weekday: 'long', hour: 'numeric', minute: '2-digit' })}.` : 'This contest has closed.'}</Text>
          )
        ) : null}
        {a ? a.finished ? <Results attempt={a} subject={c?.subjectTitle ?? null} settings={data!.contestSettings} /> : <Attempt attempt={a} onOver={() => void refetch()} /> : null}
      </ScrollView>
    </View>
  )
}

function Attempt({ attempt: a, onOver }: { attempt: ContestAttemptFieldsFragment; onOver: () => void }) {
  const [now, setNow] = useState(() => Date.now())
  const [chosen, setChosen] = useState<Record<string, string>>(() => Object.fromEntries(a.questions.flatMap((q) => (q.myChoiceId ? [[q.id, q.myChoiceId]] : []))))
  const [problem, setProblem] = useState<string | null>(null)
  const [answer] = useMutation(AnswerContestQuestionDocument)
  const [submit, submitting] = useMutation(SubmitContestDocument, { refetchQueries: [ContestDocument] })
  const left = Math.max(0, Math.ceil((new Date(a.deadline).getTime() - now) / 1000))
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  // The server marks the attempt at its deadline; reading it again (once) shows the results.
  const over = useRef(false)
  useEffect(() => {
    if (left === 0 && !over.current) {
      over.current = true
      onOver()
    }
  }, [left, onOver])
  return (
    <View className="gap-4">
      <View className="bg-card border-border flex-row items-center justify-between rounded-2xl border px-4 py-3">
        <Text className="text-muted-foreground text-sm">{`${Object.keys(chosen).length} of ${a.questions.length} answered`}</Text>
        <Text accessibilityLabel="Time left" className={`text-lg font-semibold ${left < 60 ? 'text-destructive' : ''}`}>
          {`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}
        </Text>
      </View>
      {a.questions.map((q, i) => (
        <View key={q.id} className="bg-card border-border gap-2 rounded-2xl border p-4">
          <Text className="font-semibold">{`${i + 1}. ${q.prompt}`}</Text>
          <View accessibilityRole="radiogroup" accessibilityLabel={q.prompt} className="gap-2">
            {q.choices.map((choice) => {
              const on = chosen[q.id] === choice.id
              return (
                <Pressable
                  key={choice.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={choice.text}
                  onPress={async () => {
                    setChosen((x) => ({ ...x, [q.id]: choice.id }))
                    const res = await answer({ variables: { input: { attemptId: a.id, questionId: q.id, choiceId: choice.id } } }).catch(() => null)
                    setProblem(res?.data?.answerContestQuestion.userErrors[0]?.message ?? (res ? null : 'That didn’t work. Try again.'))
                  }}
                  className={`rounded-xl border px-4 py-3 ${on ? 'border-primary bg-secondary' : 'border-border'}`}
                >
                  <Text className={on ? 'text-primary font-semibold' : ''}>{choice.text}</Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      ))}
      {problem ? (
        <Text accessibilityRole="alert" className="text-destructive text-sm">
          {problem}
        </Text>
      ) : null}
      <Pressable accessibilityRole="button" disabled={submitting.loading} onPress={() => void submit({ variables: { attemptId: a.id } })} className="bg-primary self-start rounded-xl px-5 py-2.5">
        <Text className="text-primary-foreground font-semibold">Submit</Text>
      </Pressable>
    </View>
  )
}

function Results({ attempt: a, subject, settings }: { attempt: ContestAttemptFieldsFragment; subject: string | null; settings: { showBands: boolean; canShowBands: boolean } }) {
  const [setBands, bands] = useMutation(SetContestBandsDocument, { refetchQueries: [ContestDocument] })
  const [compare, setCompare] = useState(settings.showBands)
  return (
    <View className="gap-4">
      <View className="bg-card border-border gap-2 rounded-3xl border p-5">
        <Text className="text-3xl font-semibold">{`${a.score ?? 0} of ${a.total}`}</Text>
        {a.personalBest !== null && a.personalBest !== undefined ? <Text className="text-muted-foreground text-sm">{subject ? `Your best on ${subject}: ${a.personalBest}%` : `Your best in contests: ${a.personalBest}%`}</Text> : null}
        {a.band ? <Text className="text-primary text-sm font-semibold">{BAND[a.band]}</Text> : null}
        {settings.canShowBands ? (
          <View className="mt-2 flex-row items-center gap-3">
            <View className="flex-1">
              <Text className="font-semibold">Show me how I compare (adults only)</Text>
              <Text className="text-muted-foreground text-xs">Once a contest closes, see if you’re in the top 10%, 25% or half of adults who took it. No one else sees it.</Text>
            </View>
            <Switch
              accessibilityLabel="Show me how I compare"
              value={compare}
              disabled={bands.loading}
              onValueChange={async (show) => {
                setCompare(show)
                const res = await setBands({ variables: { show } }).catch(() => null)
                if (!res?.data?.setContestBands.settings) setCompare(!show)
              }}
            />
          </View>
        ) : null}
      </View>
      {a.questions.map((q, i) => (
        <View key={q.id} className="bg-card border-border gap-2 rounded-2xl border p-4">
          <Text className="font-semibold">{`${i + 1}. ${q.prompt}`}</Text>
          {q.choices.map((choice) => {
            const right = choice.id === q.correctChoiceId
            const mine = choice.id === q.myChoiceId
            return (
              <View key={choice.id} accessibilityLabel={`${choice.text}${right ? ', right answer' : ''}${mine ? ', your answer' : ''}`} className={`flex-row items-center gap-2 rounded-xl px-3 py-2 ${right ? 'bg-secondary' : mine ? 'bg-muted' : ''}`}>
                {right ? <Check size={16} color="#0f6b45" /> : mine ? <X size={16} color="#9f1d1d" /> : <View className="size-4" />}
                <Text className="flex-1">{choice.text}</Text>
                {mine ? <Text className="text-xs font-semibold">Your answer</Text> : null}
              </View>
            )
          })}
          {!q.myChoiceId ? <Text className="text-muted-foreground text-xs">Not answered.</Text> : null}
          {q.explanation ? <Text className="text-muted-foreground text-sm">{q.explanation}</Text> : null}
        </View>
      ))}
    </View>
  )
}
