import { useQuery } from '@apollo/client/react'
import { View } from 'react-native'
import { Text } from '@/components/ui/text'
import { ClassroomPerformanceDocument, ClassroomRhythmRingDocument } from '@/graphql/generated/graphql'
import { cn } from '@/lib/utils'

/**
 * A class's Rhythm this week on the phone (lvn-backend ADR-0072): totals for every member, and the names of the
 * students who chose to share (a child account by first name).
 */
export function ClassRhythm({ classroomId }: { classroomId: string }) {
  const { data } = useQuery(ClassroomRhythmRingDocument, { variables: { id: classroomId }, fetchPolicy: 'cache-and-network' })
  const ring = data?.classroom?.rhythmRing
  if (!ring) return null
  return (
    <View className="gap-3">
      <Text className="text-sm">
        {ring.metCount} of {ring.students} students met their week · {ring.countedDays} of {ring.targetDays} days counted
      </Text>
      <View className="bg-muted h-2.5 rounded-full">
        <View className="bg-primary h-full rounded-full" style={{ width: `${ring.targetDays ? Math.min(Math.round((ring.countedDays / ring.targetDays) * 100), 100) : 0}%` }} />
      </View>
      <Text className="font-semibold">Sharing their Rhythm</Text>
      {!ring.people.length ? <Text className="text-muted-foreground text-sm">No one in this class shares their Rhythm yet.</Text> : null}
      {ring.people.map((p) => (
        <View key={p.user.id} className="bg-muted flex-row items-center justify-between rounded-xl px-3 py-2">
          <Text className="font-medium">{p.name}</Text>
          <Text className={cn('text-sm', p.met ? 'text-primary' : 'text-muted-foreground')}>
            {p.countedDays} of {p.target} days
          </Text>
        </View>
      ))}
    </View>
  )
}

/** For staff: each student's first quiz scores and the topics the class finds hard. */
export function ClassPerformance({ classroomId }: { classroomId: string }) {
  const { data } = useQuery(ClassroomPerformanceDocument, { variables: { id: classroomId }, fetchPolicy: 'cache-and-network' })
  const p = data?.classroom?.performance
  if (!p) return null
  return (
    <View className="gap-3">
      <Text className="text-muted-foreground text-sm">Each student’s first score on each quiz, and the topics the class finds hard.</Text>
      {!p.quizzes ? <Text className="text-muted-foreground text-sm">No quizzes yet. Publish one and results appear here.</Text> : null}
      {p.quizzes
        ? p.students.map((s) => (
            <View key={s.user.id} accessible accessibilityLabel={`${s.name}: ${s.submitted} of ${p.quizzes} quizzes, ${s.average === null ? 'no average yet' : `average ${Math.round(s.average * 100)}%`}`} className="bg-muted flex-row items-center justify-between rounded-xl px-3 py-2">
              <Text className="font-medium">{s.name}</Text>
              <Text className="text-muted-foreground text-sm">
                {s.submitted}/{p.quizzes} · {s.average === null ? '—' : `${Math.round(s.average * 100)}%`}
              </Text>
            </View>
          ))
        : null}
      <Text className="font-semibold">Topics</Text>
      {!p.topics.length ? <Text className="text-muted-foreground text-sm">Quizzes made from notes with topics show which topics are hard.</Text> : null}
      {p.topics.map((t) => (
        <View key={t.key} className="bg-muted flex-row items-center justify-between rounded-xl px-3 py-2">
          <Text className="font-medium">
            {t.title}
            {t.hard ? ' · Hard' : ''}
          </Text>
          <Text className="text-muted-foreground text-sm">
            {Math.round(t.accuracy * 100)}% right of {t.answers}
          </Text>
        </View>
      ))}
    </View>
  )
}
