import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg'
import { View } from 'react-native'
import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'
import logo from '@/assets/brand/logo-paths.json'

/** The LearnViaNotes mark on its indigo tile, drawn from the same paths as the app icon (assets/brand/logo-paths.json). */
export function Logo({ size = 32 }: { size?: number }) {
  const c = logo.colors
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <LinearGradient id="lvn-bg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={c.gradient[0]} />
          <Stop offset="0.55" stopColor={c.gradient[1]} />
          <Stop offset="1" stopColor={c.gradient[2]} />
        </LinearGradient>
        <RadialGradient id="lvn-glow" cx="0.22" cy="0.18" r="0.75">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.22} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={1024} height={1024} rx={logo.tileRadius} fill="url(#lvn-bg)" />
      <Rect width={1024} height={1024} rx={logo.tileRadius} fill="url(#lvn-glow)" />
      <Path d={logo.leftPage} fill={c.page} />
      <Path d={logo.rightPage} fill={c.pageShade} />
      {logo.lines.map((d) => (
        <Path key={d} d={d} fill="none" stroke={c.line} strokeWidth={18} strokeLinecap="round" />
      ))}
      <Path d={logo.check} fill="none" stroke={c.check} strokeWidth={28} strokeLinecap="round" strokeLinejoin="round" />
      <Path d={logo.spark} fill={c.spark} />
    </Svg>
  )
}

/** Logo plus the full name. "Notes" carries the brand colour. */
export function Wordmark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <View className={cn('flex-row items-center gap-2', className)} accessible accessibilityRole="header" accessibilityLabel="LearnViaNotes">
      <Logo size={size} />
      <Text className="text-xl font-extrabold tracking-tight">
        LearnVia<Text className="text-primary text-xl font-extrabold tracking-tight">Notes</Text>
      </Text>
    </View>
  )
}
