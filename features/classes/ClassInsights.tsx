import { useMutation, useQuery } from '@apollo/client/react'
import { useState } from 'react'
import { Pressable, TextInput, View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { LoadState } from '@/features/shell/LoadState'
import { ClassroomPerformanceDocument, ClassroomRhythmRingDocument, SetClassGoalDocument, type ClassroomRhythmRingQuery } from '@/graphql/generated/graphql'
import { cn } from '@/lib/utils'

/**
 * A class's Rhythm this week on the phone (lvn-backend ADR-0072): totals for every member, and the names of the
 * students who chose to share (a child account by first name).
 */
export function ClassRhythm({ classroomId, staff = false }: { classroomId: string; staff?: boolean }) {
  const query = useQuery(ClassroomRhythmRingDocument, { variables: { id: classroomId }, fetchPolicy: 'cache-and-network' })
  const ring = query.data?.classroom?.rhythmRing
  if (!ring) return <LoadState query={query} message="The class’s Rhythm could not load." />
  return (
    <View className="gap-3">
      <Text className="text-sm">
        {ring.metCount} of {ring.students} students met their week · {ring.countedDays} of {ring.targetDays} days counted
      </Text>
      <View className="bg-muted h-2.5 rounded-full">
        <View className="bg-primary h-full rounded-full" style={{ width: `${ring.targetDays ? Math.min(Math.round((ring.countedDays / ring.targetDays) * 100), 100) : 0}%` }} />
      </View>
      {ring.goal || staff ? <ClassGoal classroomId={classroomId} goal={ring.goal ?? null} staff={staff} /> : null}
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
  const query = useQuery(ClassroomPerformanceDocument, { variables: { id: classroomId }, fetchPolicy: 'cache-and-network' })
  const p = query.data?.classroom?.performance
  if (!p) return <LoadState query={query} message="The class’s results could not load." />
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

type Goal = NonNullable<NonNullable<NonNullable<ClassroomRhythmRingQuery['classroom']>['rhythmRing']>['goal']>

/**
 * The class's goal this week (lvn-backend ADR-0081): counted days across the class against a target, each student
 * up to a share; everyone sees the total, teachers each part, and teachers set it, let it size itself, or turn it off.
 */
function ClassGoal({ classroomId, goal, staff }: { classroomId: string; goal: Goal | null; staff: boolean }) {
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#3d4b63')
  const [target, setTarget] = useState(goal && !goal.automatic ? String(goal.target) : '')
  const [problem, setProblem] = useState<string | null>(null)
  const [set, setting] = useMutation(SetClassGoalDocument, { refetchQueries: [ClassroomRhythmRingDocument] })
  const save = async (on: boolean) => {
    const value = target.trim() ? Number(target) : null
    const res = await set({ variables: { input: { classroomId, on, target: on ? value : null } } }).catch(() => null)
    setProblem(res?.data?.setClassGoal.userErrors[0]?.message ?? (res ? null : 'That didn’t work. Try again.'))
  }
  return (
    <View className="border-border gap-2 rounded-2xl border p-3">
      <Text className="font-semibold" accessibilityRole="header">
        Class goal this week
      </Text>
      {goal ? (
        <>
          <View className="bg-muted h-2 rounded-full" accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: goal.target, now: Math.min(goal.progress, goal.target) }}>
            <View className="bg-primary h-full rounded-full" style={{ width: `${Math.round(Math.min(goal.progress / goal.target, 1) * 100)}%` }} />
          </View>
          <Text className="text-sm">
            {goal.reached ? 'Reached: ' : ''}
            {goal.progress} of {goal.target} counted days, together
          </Text>
          <Text className="text-muted-foreground text-xs">Each student counts up to {goal.sharePerStudent} days, so no one carries it alone.</Text>
          {goal.parts ? (
            <View className="gap-1">
              <Text className="text-muted-foreground text-xs">Each student’s part (only teachers see this)</Text>
              {goal.parts.map((p) => (
                <View key={p.user.id} className="flex-row justify-between">
                  <Text className="flex-1 text-sm">{p.user.displayName}</Text>
                  <Text className="text-muted-foreground text-sm">{p.countedDays === 1 ? '1 day' : `${p.countedDays} days`}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : (
        <Text className="text-muted-foreground text-sm">No class goal this week. Teachers can set one.</Text>
      )}
      {staff ? (
        <View className="gap-2">
          <TextInput
            accessibilityLabel="Target in counted days"
            value={target}
            onChangeText={setTarget}
            keyboardType="number-pad"
            placeholder="Size it from the class"
            placeholderTextColor={muted}
            className="border-border text-foreground rounded-xl border px-3 py-2"
          />
          <View className="flex-row gap-2">
            <Pressable accessibilityRole="button" disabled={setting.loading} onPress={() => void save(true)} className="bg-primary rounded-xl px-4 py-2.5">
              <Text className="text-primary-foreground font-semibold">{goal ? 'Update the goal' : 'Set a class goal'}</Text>
            </Pressable>
            {goal ? (
              <Pressable accessibilityRole="button" disabled={setting.loading} onPress={() => void save(false)} className="border-border rounded-xl border px-4 py-2.5">
                <Text className="font-semibold">Turn it off</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
      {problem ? (
        <Text accessibilityRole="alert" className="text-destructive text-sm">
          {problem}
        </Text>
      ) : null}
    </View>
  )
}
