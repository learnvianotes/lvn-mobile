import { useMutation, useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { ListChecks, Trash2 } from 'lucide-react-native'
import { useState } from 'react'
import { Alert, Pressable, View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { attempt } from '@/features/groups/shared'
import { Pill } from '@/features/shell/Form'
import { ClassroomQuizzesDocument, DeleteClassQuizDocument, type ClassQuizListFieldsFragment, type ClassroomDetailFragment } from '@/graphql/generated/graphql'

/** A person's score on a quiz: their first attempt (lvn-backend ADR-0064); attempts come newest first. */
export const scoreOf = (q: Pick<ClassQuizListFieldsFragment, 'myAttempts'>) => q.myAttempts.at(-1) ?? null
export const questions = (n: number) => `${n} question${n === 1 ? '' : 's'}`

/** The class's quizzes on the phone (lvn-backend ADR-0064): every member takes them; staff publish and remove them. */
export function ClassQuizzes({ classroom }: { classroom: ClassroomDetailFragment }) {
  const accent = String(useCSSVariable('--color-primary') ?? '#1e4d8c')
  const fg = String(useCSSVariable('--color-foreground') ?? '#152033')
  const { data, loading, refetch } = useQuery(ClassroomQuizzesDocument, { variables: { id: classroom.id }, fetchPolicy: 'cache-and-network' })
  const [remove] = useMutation(DeleteClassQuizDocument)
  const [error, setError] = useState<string | null>(null)
  const quizzes = data?.classroom?.quizzes ?? []
  const staff = classroom.viewerCan.publishQuiz
  const confirmRemove = (q: ClassQuizListFieldsFragment) =>
    Alert.alert('Remove this quiz?', `Students will no longer see “${q.title}”.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void attempt(() => remove({ variables: { quizId: q.id } })).then((p) => (setError(p), void refetch())) },
    ])

  return (
    <View className="gap-3">
      {staff ? (
        <View className="gap-1">
          <Pill label="New quiz" primary onPress={() => router.push(`/classes/${classroom.id}/quizzes/new`)} />
          <Text className="text-muted-foreground text-xs">Make questions from one of your notes with AI, or write your own.</Text>
        </View>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" className="text-destructive text-sm">
          {error}
        </Text>
      ) : null}
      {data && !quizzes.length ? <Text className="text-muted-foreground text-sm">{staff ? 'No quizzes yet. Publish one and every member is told.' : 'No quizzes yet. Your teacher will publish them here.'}</Text> : null}
      {loading && !data ? <Text className="text-muted-foreground text-sm">Loading…</Text> : null}
      {quizzes.map((q) => {
        const score = scoreOf(q)
        return (
          <View key={q.id} className="bg-card border-border flex-row items-start gap-3 rounded-2xl border p-4">
            <ListChecks size={20} color={accent} />
            <Pressable accessibilityRole="button" accessibilityLabel={`Open ${q.title}`} onPress={() => router.push(`/classes/${classroom.id}/quizzes/${q.id}`)} className="flex-1 gap-1">
              <Text className="font-semibold">{q.title}</Text>
              <Text className="text-muted-foreground text-xs">
                {questions(q.questionCount)} · by {q.author.displayName}
              </Text>
              <Text className="text-sm">
                {score ? `Your score: ${score.score} of ${score.total}` : 'Not taken yet'}
                {q.submittedCount != null ? ` · ${q.submittedCount === 0 ? 'No student has submitted yet' : `${q.submittedCount} student${q.submittedCount === 1 ? ' has' : 's have'} submitted`}` : ''}
              </Text>
            </Pressable>
            {q.viewerCanDelete ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${q.title}`} onPress={() => confirmRemove(q)} hitSlop={8} className="p-1">
                <Trash2 size={18} color={fg} />
              </Pressable>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}
