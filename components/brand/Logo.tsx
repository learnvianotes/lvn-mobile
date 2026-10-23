import { router } from 'expo-router'
import { Pressable, View } from 'react-native'
import Svg, { Path, Rect } from 'react-native-svg'
import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'
import { useTheme } from '@/lib/theme'
import logo from '@/assets/brand/logo-paths.json'

/** Flat brand tile. The spark and the glow are not drawn. */
export function Logo({ size = 30 }: { size?: number }) {
  const { palette } = useTheme()
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 1024 1024">
        <Rect width={1024} height={1024} rx={logo.tileRadius} fill={palette.brand} />
        <Path d={logo.leftPage} fill={palette.surface} />
        <Path d={logo.rightPage} fill={palette.brandSoft} />
        {logo.lines.map((d) => (
          <Path key={d} d={d} fill="none" stroke={palette.brand} strokeWidth={18} strokeLinecap="round" />
        ))}
        <Path d={logo.check} fill="none" stroke={palette.brand} strokeWidth={28} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  )
}

/** Logo plus the name. "Notes" carries the brand colour. On this app both homes are `/`. */
export function Wordmark({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <Pressable
      accessibilityRole="header"
      accessibilityLabel="LearnViaNotes"
      className={cn('min-h-10 flex-row items-center gap-2', className)}
      onPress={() => router.push('/')}
    >
      <Logo size={size} />
      <Text className="text-lg font-extrabold tracking-tight">
        LearnVia<Text className="text-primary text-lg font-extrabold tracking-tight">Notes</Text>
      </Text>
    </Pressable>
  )
}
