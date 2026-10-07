import { CalendarClock } from 'lucide-react-native'
import { View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Progress } from '@/components/ui/progress'
import { Text } from '@/components/ui/text'
import { exam } from './mock'

/** Exam Readiness (ADR-0030): mastery-based %, with the target line for this point before the exam. */
export function ExamReadiness() {
  const warm = String(useCSSVariable('--color-warm') ?? '#c2410c')
  return (
    <View className="bg-card border-border gap-3 rounded-3xl border p-4">
      <View className="flex-row items-center gap-3">
        <View className="bg-warm-soft size-10 items-center justify-center rounded-xl">
          <CalendarClock size={20} color={warm} />
        </View>
        <View className="flex-1">
          <Text className="text-muted-foreground text-xs font-medium">Upcoming exam · in {exam.daysLeft} days</Text>
          <Text className="font-semibold">{exam.subject}</Text>
        </View>
        <Text className="text-primary text-xl font-bold">{Math.round(exam.readiness * 100)}%</Text>
      </View>
      <View>
        <Progress value={exam.readiness * 100} className="h-2.5" accessibilityLabel={`Readiness ${Math.round(exam.readiness * 100)} percent`} />
        <View className="bg-foreground absolute -top-1 h-4.5 w-0.5 rounded-full" style={{ left: `${exam.target * 100}%` }} />
      </View>
      <Text className="text-muted-foreground text-xs">Target for today: {Math.round(exam.target * 100)}% · 2 topics to strengthen</Text>
    </View>
  )
}
