import { useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { Check, Pause } from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { ringPercent } from '@/features/learning/RhythmScreen'
import { Loading, LoadFailed } from '@/features/shell/LoadState'
import { RhythmDocument } from '@/graphql/generated/graphql'
import { cn } from '@/lib/utils'
import { TodayRing } from './TodayRing'

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/**
 * Rhythm on Home (ADR-0030, lvn-backend ADR-0069): today's ring and what fills it, the week (planned, counted, rest —
 * never red), and the counter that never resets. Tapping opens Rhythm.
 */
export function RhythmCard() {
  const success = String(useCSSVariable('--color-success') ?? '#0f6b45')
  const primaryFg = String(useCSSVariable('--color-primary-foreground') ?? '#ffffff')
  const secondaryFg = String(useCSSVariable('--color-secondary-foreground') ?? '#2847a8')
  const { data, error, refetch } = useQuery(RhythmDocument, { fetchPolicy: 'cache-and-network' })
  const r = data?.rhythm
  if (!r) {
    if (error) return <LoadFailed message="Today’s Rhythm could not load." onRetry={refetch} />
    // The card's place while it loads, so the sections below do not jump.
    return (
      <View className="bg-card border-border h-64 justify-center rounded-3xl border">
        <Loading />
      </View>
    )
  }
  const t = r.today
  const percent = ringPercent(t)
  const paused = r.pauses.some((p) => p.active)
  const items = t.items.flatMap((i) =>
    i.kind === 'REVIEWS' ? (i.total ? [`Reviews: ${i.done} of ${i.total}`] : []) : i.kind === 'PLAN_TASK' ? [`Revision for ${i.title}: ${i.done} of ${i.total}`] : i.kind === 'WEAK_TOPIC' ? [`Weak topic: ${i.title ?? i.topicKey}`] : [],
  )
  return (
    <Pressable accessibilityRole="link" accessibilityHint="Opens Rhythm" onPress={() => router.push('/rhythm')} className="bg-card border-border gap-4 rounded-3xl border p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-semibold">Today</Text>
        {paused ? (
          <View className="bg-secondary flex-row items-center gap-1.5 rounded-full px-3 py-1">
            <Pause size={12} color={secondaryFg} />
            <Text className="text-secondary-foreground text-xs font-medium">Paused</Text>
          </View>
        ) : null}
      </View>
      <View className="flex-row items-center gap-4">
        <TodayRing done={percent} dayBar={100} full={100} label={`Today’s ring: ${percent}% of the way to a counted day`} centre={{ value: `${percent}%`, caption: 'today' }} />
        <View className="flex-1 gap-2">
          {t.cameBack ? <Text className="text-primary text-sm font-semibold">Back on rhythm.</Text> : null}
          {t.comeback ? <Text className="text-primary text-sm font-semibold">Comeback day: 10 minutes put you back on rhythm.</Text> : null}
          {items.map((item) => (
            <View key={item} className="flex-row items-center gap-2">
              <View className="bg-primary size-1.5 rounded-full" />
              <Text className="text-sm">{item}</Text>
            </View>
          ))}
          {t.counted ? (
            <Animated.View entering={ZoomIn.springify().damping(14)} className="bg-success-soft mt-1 flex-row items-center gap-1.5 self-start rounded-full px-3 py-1">
              <Check size={14} color={success} />
              <Text className="text-success text-xs font-semibold">Day counted</Text>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeIn}>
              <Text className="text-muted-foreground mt-1 text-xs">10 learning minutes or 10 reviews and today counts</Text>
            </Animated.View>
          )}
        </View>
      </View>
      <View className="border-border gap-3 border-t pt-4">
        <View className="flex-row justify-between">
          {r.week.map((d, i) => {
            const status = d.status === 'AHEAD' && !d.planned ? 'rest day' : d.status === 'MISSED' ? 'planned, not counted' : d.status === 'REST' ? 'rest day' : d.status.toLowerCase()
            return (
              <View key={d.day} className="items-center gap-1.5" accessible accessibilityLabel={`${NAMES[i]}: ${status}`}>
                <Text className={cn('text-xs', d.day === t.day ? 'text-primary font-semibold' : 'text-muted-foreground')}>{LETTERS[i]}</Text>
                <View className={cn('size-8 items-center justify-center rounded-full', d.counted ? 'bg-primary' : d.planned && d.status !== 'PAUSED' ? 'border-primary border-2' : 'bg-muted', d.status === 'MISSED' && 'border-dashed')}>
                  {d.counted ? <Check size={14} color={primaryFg} /> : null}
                </View>
              </View>
            )
          })}
        </View>
        <Text className="text-muted-foreground text-xs">
          {r.countedDays} of {r.target} planned days this week · Rhythm weeks this term: {r.weeksThisTerm}
        </Text>
      </View>
    </Pressable>
  )
}
