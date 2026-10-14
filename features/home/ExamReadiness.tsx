import { useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { CalendarClock } from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Progress } from '@/components/ui/progress'
import { Text } from '@/components/ui/text'
import { LoadFailed } from '@/features/shell/LoadState'
import { ExamsDocument } from '@/graphql/generated/graphql'

const inDays = (n: number) => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`)

/** The next exam's Readiness (ADR-0030, lvn-backend ADR-0070) against today's target line; or a way to add one. */
export function ExamReadiness() {
  const warm = String(useCSSVariable('--color-warm') ?? '#c2410c')
  const { data, error, refetch } = useQuery(ExamsDocument, { fetchPolicy: 'cache-and-network' })
  const exam = data?.exams.find((e) => !e.past)
  if (!data) {
    if (error) return <LoadFailed inline message="Your exams could not load." onRetry={refetch} />
    // The card's place while it loads (the Rhythm card above shows the spinner).
    return <View accessible accessibilityLabel="Loading your exams" className="bg-card border-border h-[74px] rounded-3xl border" />
  }
  if (!exam) {
    return (
      <Pressable accessibilityRole="link" onPress={() => router.push('/exams')} className="bg-card border-border flex-row items-center gap-3 rounded-3xl border p-4">
        <View className="bg-warm-soft size-10 items-center justify-center rounded-xl">
          <CalendarClock size={20} color={warm} />
        </View>
        <View className="flex-1">
          <Text className="font-semibold">Add an exam</Text>
          <Text className="text-muted-foreground text-xs">A revision plan, and how ready you are</Text>
        </View>
      </Pressable>
    )
  }
  const weak = exam.topics.filter((t) => t.mastery < 0.6).length
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`${exam.name}, ${inDays(exam.daysLeft)}: readiness ${exam.readiness}%, target today ${exam.targetToday}%`} onPress={() => router.push(`/exams/${exam.id}`)} className="bg-card border-border gap-3 rounded-3xl border p-4">
      <View className="flex-row items-center gap-3">
        <View className="bg-warm-soft size-10 items-center justify-center rounded-xl">
          <CalendarClock size={20} color={warm} />
        </View>
        <View className="flex-1">
          <Text className="text-muted-foreground text-xs font-medium">Upcoming exam · {inDays(exam.daysLeft)}</Text>
          <Text className="font-semibold">{exam.name}</Text>
        </View>
        <Text className="text-primary text-xl font-bold">{exam.readiness}%</Text>
      </View>
      <View>
        <Progress value={exam.readiness} className="h-2.5" />
        <View className="bg-foreground absolute -top-1 h-4.5 w-0.5 rounded-full" style={{ left: `${exam.targetToday}%` }} />
      </View>
      <Text className="text-muted-foreground text-xs">
        Target for today: {exam.targetToday}%{weak ? ` · ${weak} ${weak === 1 ? 'topic' : 'topics'} to strengthen` : ''}
      </Text>
    </Pressable>
  )
}
