import { GraduationCap } from 'lucide-react-native'
import { View } from 'react-native'
import Svg, { Circle, Line } from 'react-native-svg'
import { Text } from '@/components/ui/text'
import { useTheme } from '@/lib/theme'

/** The landing illustration: a note, a small tree, a flashcard and a cap. No sparkle, no pink. */
export function LandingArt() {
  const { palette } = useTheme()
  return (
    <View accessible accessibilityLabel="A note, flashcards and a question answered" className="mt-2 h-72">
      <View className="bg-card border-border absolute left-2 top-6 w-48 rounded-2xl border p-4" style={{ shadowColor: '#152033', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}>
        <View className="mb-3 flex-row items-center justify-between">
          <View className="bg-muted h-2 w-16 rounded-full" />
          <View className="bg-success size-5 items-center justify-center rounded-full">
            <Text className="text-primary-foreground text-[10px] font-bold">✓</Text>
          </View>
        </View>
        <View className="bg-muted mb-2 h-2 w-full rounded-full" />
        <View className="bg-muted mb-3 h-2 w-4/5 rounded-full" />
        <Svg width={120} height={56} viewBox="0 0 120 56">
          <Circle cx="28" cy="36" r="8" fill={palette.info} />
          <Circle cx="60" cy="16" r="8" fill={palette.warning} />
          <Circle cx="96" cy="34" r="8" fill={palette.brand} />
          <Line x1="36" y1="32" x2="52" y2="20" stroke={palette.lineStrong} strokeWidth="2" />
          <Line x1="68" y1="20" x2="88" y2="32" stroke={palette.lineStrong} strokeWidth="2" />
        </Svg>
      </View>
      <View className="bg-warm-soft absolute right-2 top-2 size-16 items-center justify-center rounded-full">
        <GraduationCap size={32} color={palette.warning} />
      </View>
      <View className="bg-card border-border absolute bottom-10 right-0 w-40 rounded-2xl border p-3">
        <Text className="text-sm font-semibold">What is a BST?</Text>
      </View>
      <View className="bg-primary absolute bottom-0 right-6 rounded-full px-4 py-2">
        <Text className="text-primary-foreground text-sm font-semibold">Explain simply</Text>
      </View>
    </View>
  )
}
