import { router } from 'expo-router'
import { Pressable, View } from 'react-native'
import Svg, { Path, Rect } from 'react-native-svg'
import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'
import logo from '@/assets/brand/logo-paths.json'

/** The LVN mark: the letters in paper on a flat ink tile, underlined by one highlighter stroke (no gradient, no glow). */
export function Logo({ size = 30 }: { size?: number }) {
  const c = logo.colors
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 1024 1024">
        <Rect width={1024} height={1024} rx={logo.tileRadius} fill={c.tile} />
        {logo.letters.map((d) => (
          <Path key={d} d={d} fill={c.letter} />
        ))}
        <Path d={logo.marker} fill={c.marker} />
      </Svg>
    </View>
  )
}

/** Logo plus the name, in one colour and the interface family. On this app both homes are `/`. */
export function Wordmark({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <Pressable
      accessibilityRole="header"
      accessibilityLabel="LearnViaNotes"
      className={cn('min-h-10 flex-row items-center gap-2', className)}
      onPress={() => router.push('/')}
    >
      <Logo size={size} />
      <Text className="text-lg font-semibold">LearnViaNotes</Text>
    </Pressable>
  )
}
