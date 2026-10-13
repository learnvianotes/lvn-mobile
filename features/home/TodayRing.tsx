import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

type Props = {
  done: number
  dayBar: number
  full: number
  size?: number
  /** What a screen reader says, and what the centre shows, when the ring is not counting reviews */
  label?: string
  centre?: { value: string; caption: string }
}

/**
 * The Today ring (ADR-0030): fills with learning actions only. A marker shows where the day counts (the low bar);
 * a full ring is a bonus. The fill animates in ~350 ms on the UI thread; reduced motion jumps straight to the value.
 */
export function TodayRing({ done, dayBar, full, size = 112, label, centre }: Props) {
  const stroke = 11
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const reduced = useReducedMotion()
  const progress = useSharedValue(0)
  const primary = String(useCSSVariable('--color-primary') ?? '#4f46e5')
  const track = String(useCSSVariable('--color-secondary') ?? '#eef2ff')
  const success = String(useCSSVariable('--color-success') ?? '#15803d')

  useEffect(() => {
    const target = Math.min(done / full, 1)
    progress.value = reduced ? target : withTiming(target, { duration: 350, easing: Easing.out(Easing.cubic) })
  }, [done, full, reduced, progress])

  const arc = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - progress.value) }))
  const counted = done >= dayBar
  // The day-bar marker sits on the ring at dayBar / full of the way round, starting at 12 o'clock.
  const angle = (dayBar / full) * 2 * Math.PI - Math.PI / 2
  const mx = size / 2 + r * Math.cos(angle)
  const my = size / 2 + r * Math.sin(angle)

  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? `Today: ${done} of ${full} reviews. ${counted ? 'Day counted.' : `${dayBar - done} more to count today.`}`}
    >
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={counted ? success : primary}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          animatedProps={arc}
        />
      </Svg>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={mx} cy={my} r={3.5} fill={counted ? success : primary} opacity={counted ? 0 : 0.9} />
      </Svg>
      <View className="absolute inset-0 items-center justify-center">
        <Text className="text-2xl font-bold">{centre?.value ?? done}</Text>
        <Text className="text-muted-foreground text-xs">{centre?.caption ?? `of ${full}`}</Text>
      </View>
    </View>
  )
}
