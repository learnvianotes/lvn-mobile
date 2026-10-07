import type { ReactNode } from 'react'
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated'
import { haptic } from '@/lib/haptics'

type Props = Omit<PressableProps, 'children' | 'style'> & {
  children: ReactNode
  /** How far the element shrinks while pressed. */
  scaleTo?: number
  feedback?: 'tick' | 'press' | 'none'
  style?: StyleProp<ViewStyle>
}

/**
 * Press feedback within the first frame: a spring scale on the UI thread plus a haptic tick (ADR-0030, < 100 ms).
 * The animated wrapper carries only the transform; layout and colours stay on className'd children.
 */
export function PressScale({ children, scaleTo = 0.96, feedback = 'tick', onPressIn, onPressOut, style, ...props }: Props) {
  const reduced = useReducedMotion()
  const scale = useSharedValue(1)
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  return (
    <Animated.View style={[animated, style]}>
      <Pressable
        {...props}
        onPressIn={(e) => {
          if (!reduced) scale.value = withSpring(scaleTo, { damping: 18, stiffness: 420 })
          if (feedback === 'tick') haptic.tick()
          if (feedback === 'press') haptic.press()
          onPressIn?.(e)
        }}
        onPressOut={(e) => {
          scale.value = withSpring(1, { damping: 14, stiffness: 320 })
          onPressOut?.(e)
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  )
}
