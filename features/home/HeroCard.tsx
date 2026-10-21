import { useQuery } from '@apollo/client/react'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated'
import Svg, { Circle, Path } from 'react-native-svg'
import { Text } from '@/components/ui/text'
import { DailyLineDocument } from '@/graphql/generated/graphql'

const STARS = [
  [18, 22, 1.4], [52, 12, 1], [86, 30, 1.6], [128, 16, 1.1], [168, 34, 1.3], [210, 14, 1], [248, 28, 1.5],
  [290, 10, 1.2], [36, 48, 1], [120, 52, 1.2], [200, 56, 1], [276, 50, 1.3],
] as const

/** While AI writes today's line, how often and how long Home asks again. */
const POLL_MS = 4_000
const POLL_FOR_MS = 60_000
/** What shows before the day's line has loaded. */
const RESTING = { title: 'Make it happen', line: 'Discipline today creates the freedom tomorrow.' }

/**
 * Night-sky hero card from the UI board, with the day's line (lvn-backend ADR-0087): a headline and a sentence written
 * by AI for the person each day (a chosen line until it is written); stars twinkle slowly (off with reduced motion).
 */
export function HeroCard({ firstName }: { firstName: string }) {
  const [polling, setPolling] = useState(true)
  const { data, refetch } = useQuery(DailyLineDocument, { fetchPolicy: 'cache-and-network' })
  const today = data?.dailyLine ?? RESTING
  const pending = !!data?.dailyLine.pending && polling
  // AI is writing today's line: ask again every few seconds, for a minute at most.
  useEffect(() => {
    if (!pending) return
    const timer = setInterval(() => void refetch().catch(() => undefined), POLL_MS)
    const stop = setTimeout(() => setPolling(false), POLL_FOR_MS)
    return () => {
      clearInterval(timer)
      clearTimeout(stop)
    }
  }, [pending, refetch])
  const reduced = useReducedMotion()
  const twinkle = useSharedValue(0.5)
  useEffect(() => {
    if (reduced) return
    twinkle.value = withDelay(400, withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }), -1, true))
  }, [reduced, twinkle])
  const starsStyle = useAnimatedStyle(() => ({ opacity: twinkle.value }))

  return (
    <View testID="home-hero" className="overflow-hidden rounded-3xl" style={{ minHeight: 176 }}>
      <LinearGradient colors={['#0B1220', '#1e3a8a', '#1d4ed8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', inset: 0 }} />
      <Animated.View style={[{ position: 'absolute', inset: 0 }, starsStyle]} pointerEvents="none">
        <Svg width="100%" height="100%">
          {STARS.map(([x, y, r], i) => (
            <Circle key={i} cx={`${(x / 320) * 100}%`} cy={y} r={r} fill="#ffffff" opacity={0.85} />
          ))}
          <Circle cx="84%" cy={40} r={13} fill="#fef3c7" opacity={0.95} />
          <Circle cx="86.5%" cy={36} r={12} fill="#1e3a8a" />
        </Svg>
      </Animated.View>
      <Svg width="100%" height={86} viewBox="0 0 320 86" preserveAspectRatio="none" style={{ position: 'absolute', bottom: 0 }} pointerEvents="none">
        <Path d="M0 86 L0 52 L46 22 L82 48 L122 14 L170 58 L214 30 L262 60 L300 38 L320 50 L320 86 Z" fill="#1e3a8a" opacity={0.9} />
        <Path d="M0 86 L0 66 L60 44 L110 70 L160 50 L220 74 L270 56 L320 70 L320 86 Z" fill="#172554" />
      </Svg>
      <View className="flex-1 justify-center gap-1.5 px-5 py-5">
        <Text className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#bfdbfe' }}>
          {firstName ? `Keep learning, ${firstName}` : 'Keep learning'}
        </Text>
        <Text className="text-2xl font-bold" style={{ color: '#ffffff' }} accessibilityRole="header" numberOfLines={2}>
          {today.title}
        </Text>
        <Text className="text-sm" style={{ color: '#dbeafe', maxWidth: 240 }} numberOfLines={3}>
          {today.line}
        </Text>
      </View>
    </View>
  )
}
