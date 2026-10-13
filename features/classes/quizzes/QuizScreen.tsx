import { useMutation, useQuery } from '@apollo/client/react'
import { useRef, useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Text } from '@/components/ui/text'
import { newId } from '@/features/notes/model/ids'
import { InlineText, RichDoc } from '@/features/notes/render/RichText'
import { Pill, ScreenHeader } from '@/features/shell/Form'
import { ClassQuizDocument, SubmitQuizAttemptDocument, type ClassQuizFieldsFragment } from '@/graphql/generated/graphql'
import type { Doc, Inline } from '@/lib/contracts/validation'
import { cn } from '@/lib/utils'
import { questions, scoreOf } from './ClassQuizzes'

type Quiz = ClassQuizFieldsFragment
type Answers = Record<string, string[]>

/**
 * Taking a class quiz on the phone (lvn-backend ADR-0064): the questions without their answers, submitted once for a
 * score by the server (one submission id kept until it is answered, so a retry is the same attempt), then each
 * question's result, the correct choices and the explanation. Later tries are practice.
 */
export function QuizScreen({ quizId }: { quizId: string }) {
  const insets = useSafeAreaInsets()
  const { data, loading } = useQuery(ClassQuizDocument, { variables: { id: quizId }, fetchPolicy: 'cache-and-network' })
  const [retaking, setRetaking] = useState(false)
  const quiz = data?.classQuiz
  if (!quiz)
    return (
      <View className="bg-background flex-1">
        <ScreenHeader title="Quiz" />
        {loading ? null : <Text className="text-muted-foreground px-6 py-16 text-center">This quiz is not here: it was removed, or you are not in its class.</Text>}
      </View>
    )
  const latest = quiz.myAttempts[0] ?? null
  const first = scoreOf(quiz)
  const answering = !latest || retaking
  return (
    <View className="bg-background flex-1">
      <ScreenHeader title="Quiz" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
        <View className="gap-1">
          <Text className="text-2xl font-extrabold" accessibilityRole="header">
            {quiz.title}
          </Text>
          <Text className="text-muted-foreground text-sm">
            {questions(quiz.questionCount)} · by {quiz.author.displayName}
          </Text>
          {quiz.submittedCount != null ? <Text className="text-sm">{quiz.submittedCount === 1 ? '1 student has submitted' : `${quiz.submittedCount} students have submitted`}</Text> : null}
        </View>
        {answering ? (
          <TakeQuiz quiz={quiz} practice={!!latest} onDone={() => setRetaking(false)} />
        ) : (
          <>
            <View accessibilityLiveRegion="polite" className="border-primary/40 bg-primary/10 gap-2 rounded-2xl border p-4">
              <Text className="text-lg font-bold">
                You got {latest.score} of {latest.total}
              </Text>
              {first && first.id !== latest.id ? (
                <Text className="text-muted-foreground text-sm">
                  Your score is your first attempt: {first.score} of {first.total}
                </Text>
              ) : null}
              <Pill label="Try again" onPress={() => setRetaking(true)} />
            </View>
            <Review quiz={quiz} answers={Object.fromEntries((latest.answers ?? []).map((a) => [a.questionId, a.choiceIds]))} />
          </>
        )}
      </ScrollView>
    </View>
  )
}

function TakeQuiz({ quiz, practice, onDone }: { quiz: Quiz; practice: boolean; onDone: () => void }) {
  const [submit, submitting] = useMutation(SubmitQuizAttemptDocument)
  const [answers, setAnswers] = useState<Answers>({})
  const [error, setError] = useState<string | null>(null)
  const op = useRef<string | null>(null)
  const left = quiz.questions.filter((q) => !answers[q.id]?.length).length
  const pick = (questionId: string, choiceId: string, multiple: boolean) =>
    setAnswers((a) => {
      const now = a[questionId] ?? []
      return { ...a, [questionId]: multiple ? (now.includes(choiceId) ? now.filter((x) => x !== choiceId) : [...now, choiceId]) : [choiceId] }
    })
  const send = async () => {
    setError(null)
    op.current ??= newId()
    try {
      const res = await submit({ variables: { input: { quizId: quiz.id, clientOpId: op.current, answers: quiz.questions.map((q) => ({ questionId: q.id, choiceIds: answers[q.id] ?? [] })) } } })
      const payload = res.data?.submitQuizAttempt
      if (!payload?.attempt) return setError(payload?.userErrors[0]?.message ?? 'Your answers were not sent. Check the connection and submit again.')
      op.current = null
      onDone()
    } catch {
      setError('Your answers were not sent. Check the connection and submit again.')
    }
  }
  return (
    <View className="gap-4">
      {practice ? <Text className="text-muted-foreground text-sm">Practice: your first attempt stays your score.</Text> : null}
      {quiz.questions.map((q, i) => (
        <View key={q.id} accessibilityLabel={`Question ${i + 1}`} className="bg-card border-border gap-2 rounded-2xl border p-4">
          <View className="flex-row gap-2">
            <Text className="text-muted-foreground font-bold">{i + 1}.</Text>
            <View className="flex-1">
              <RichDoc doc={q.question as Doc} />
            </View>
          </View>
          {q.multiple ? <Text className="text-muted-foreground text-xs">Pick every correct answer.</Text> : null}
          {q.choices.map((c) => {
            const on = (answers[q.id] ?? []).includes(c.id)
            return (
              <Pressable
                key={c.id}
                accessibilityRole={q.multiple ? 'checkbox' : 'radio'}
                accessibilityState={{ checked: on }}
                onPress={() => pick(q.id, c.id, q.multiple)}
                className={cn('rounded-xl border px-3 py-2.5', on ? 'border-primary bg-primary/10' : 'border-border')}
              >
                <InlineText content={c.content as Inline} />
              </Pressable>
            )
          })}
        </View>
      ))}
      {left ? <Text className="text-muted-foreground text-sm">{left === 1 ? '1 question is unanswered; it counts as wrong.' : `${left} questions are unanswered; they count as wrong.`}</Text> : null}
      {error ? (
        <Text accessibilityRole="alert" className="text-destructive text-sm">
          {error}
        </Text>
      ) : null}
      <View className="flex-row flex-wrap gap-2">
        <Pill label={submitting.loading ? 'Submitting…' : 'Submit answers'} primary disabled={submitting.loading} onPress={() => void send()} />
        {practice ? <Pill label="Cancel" onPress={onDone} /> : null}
      </View>
    </View>
  )
}

/** The questions with the viewer's answers, the correct choices and the explanations. */
function Review({ quiz, answers }: { quiz: Quiz; answers: Answers }) {
  return (
    <View className="gap-4">
      {quiz.questions.map((q, i) => {
        const chosen = answers[q.id] ?? []
        const right = !!q.correct && chosen.length === q.correct.length && chosen.every((c) => q.correct!.includes(c))
        return (
          <View key={q.id} accessibilityLabel={`Question ${i + 1}: ${right ? 'right' : 'wrong'}`} className="bg-card border-border gap-2 rounded-2xl border p-4">
            <View className="flex-row gap-2">
              <Text className="text-muted-foreground font-bold">{i + 1}.</Text>
              <View className="flex-1">
                <RichDoc doc={q.question as Doc} />
              </View>
              <Text className={cn('text-xs font-semibold', right ? 'text-emerald-600' : 'text-destructive')}>{right ? 'Right' : 'Wrong'}</Text>
            </View>
            {q.choices.map((c) => {
              const isCorrect = !!q.correct?.includes(c.id)
              const isChosen = chosen.includes(c.id)
              return (
                <View key={c.id} className={cn('flex-row items-center gap-2 rounded-xl border px-3 py-2.5', isCorrect ? 'border-emerald-500 bg-emerald-500/10' : isChosen ? 'border-destructive bg-destructive/10' : 'border-border opacity-70')}>
                  <View className="flex-1">
                    <InlineText content={c.content as Inline} />
                  </View>
                  {isChosen ? <Text className="text-xs font-semibold">Your answer</Text> : null}
                  {isCorrect ? <Text className="text-xs font-semibold text-emerald-600">Correct</Text> : null}
                </View>
              )
            })}
            {q.explanation ? (
              <View className="opacity-80">
                <RichDoc doc={q.explanation as Doc} />
              </View>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}
