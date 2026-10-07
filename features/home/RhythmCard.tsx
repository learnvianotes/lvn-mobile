import { Check, Pause } from 'lucide-react-native'
import { useState } from 'react'
import { View } from 'react-native'
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated'
import { useCSSVariable } from 'uniwind'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'
import { rhythm, today, week } from './mock'
import { TodayRing } from './TodayRing'

/**
 * Rhythm (ADR-0030): the Today ring, the week (planned days, counted days, rest days — never red), and a counter
 * that never resets. "Review a card" stands in for real reviews in this prototype.
 */
export function RhythmCard() {
  const [done, setDone] = useState<number>(today.reviewsDone)
  const counted = done >= today.dayBar
  const success = String(useCSSVariable('--color-success') ?? '#15803d')
  const primaryFg = String(useCSSVariable('--color-primary-foreground') ?? '#ffffff')
  const plannedDays = week.filter((d) => d.target).length
  const countedDays = week.filter((d) => d.counted).length + (counted ? 1 : 0)

  const review = () => {
    if (done >= today.ringFull) return
    const next = done + 1
    setDone(next)
    if (next === today.dayBar) haptic.success()
    else haptic.tick()
  }

  return (
    <View className="bg-card border-border gap-4 rounded-3xl border p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-bold">Today</Text>
        <View className="bg-secondary flex-row items-center gap-1.5 rounded-full px-3 py-1">
          <Pause size={12} color={String(useCSSVariable('--color-secondary-foreground') ?? '#3730a3')} />
          <Text className="text-secondary-foreground text-xs font-medium">Pause</Text>
        </View>
      </View>

      <View className="flex-row items-center gap-4">
        <TodayRing done={done} dayBar={today.dayBar} full={today.ringFull} />
        <View className="flex-1 gap-2">
          {today.items.map((item) => (
            <View key={item} className="flex-row items-center gap-2">
              <View className="bg-primary size-1.5 rounded-full" />
              <Text className="text-sm">{item}</Text>
            </View>
          ))}
          {counted ? (
            <Animated.View entering={ZoomIn.springify().damping(14)} exiting={FadeOut} className="bg-success-soft mt-1 flex-row items-center gap-1.5 self-start rounded-full px-3 py-1">
              <Check size={14} color={success} />
              <Text className="text-success text-xs font-semibold">Day counted</Text>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeIn} exiting={FadeOut}>
              <Text className="text-muted-foreground mt-1 text-xs">{today.dayBar - done} more reviews and today counts</Text>
            </Animated.View>
          )}
        </View>
      </View>

      <Button onPress={review} className="h-11 rounded-xl" accessibilityLabel="Review a card">
        <Text style={{ color: primaryFg }} className="font-semibold">
          {done >= today.ringFull ? 'Ring full — great work' : 'Review a card'}
        </Text>
      </Button>

      <View className="border-border gap-3 border-t pt-4">
        <View className="flex-row justify-between">
          {week.map((d, i) => {
            const isCounted = d.counted || ('today' in d && d.today && counted)
            return (
              <View key={i} className="items-center gap-1.5" accessibilityLabel={`${d.label}: ${isCounted ? 'counted' : d.target ? 'planned' : 'rest day'}`}>
                <Text className={cn('text-xs', 'today' in d && d.today ? 'text-primary font-bold' : 'text-muted-foreground')}>{d.label}</Text>
                <View
                  className={cn(
                    'size-8 items-center justify-center rounded-full',
                    isCounted ? 'bg-primary' : d.target ? 'border-primary border-2' : 'bg-muted',
                  )}
                >
                  {isCounted ? <Check size={14} color={primaryFg} /> : null}
                </View>
              </View>
            )
          })}
        </View>
        <Text className="text-muted-foreground text-xs">
          {countedDays} of {plannedDays} planned days this week · Rhythm weeks this term: {rhythm.weeksThisTerm}
        </Text>
      </View>
    </View>
  )
}
