import { Pressable, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { Choices } from '@/features/shell/Form'
import { chooseAccent, chooseMode, resolvePalette, useTheme, type ThemeMode } from '@/lib/theme'

const MODES: { value: ThemeMode; label: string; hint?: string }[] = [
  { value: 'system', label: 'System', hint: 'Follow this phone. This is the default.' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

/** Settings picker: System / Light / Dark, then the accent themes named in tokens.json. */
export function AppearanceCard() {
  const theme = useTheme()
  return (
    <View className="gap-4">
      <Text className="text-lg font-bold" accessibilityRole="header">
        Appearance
      </Text>
      <Choices label="Theme" options={MODES} value={theme.mode} onChange={chooseMode} />
      <View className="gap-2" accessibilityRole="radiogroup" accessibilityLabel="Accent">
        <Text className="text-sm font-semibold">Accent</Text>
        {theme.accents.map((accent) => {
          const on = accent.id === theme.accent
          const swatch = resolvePalette(theme.scheme, accent.id).brand
          return (
            <Pressable key={accent.id} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={accent.label} onPress={() => chooseAccent(accent.id)} className={`min-h-11 flex-row items-center gap-3 rounded-2xl border px-3 py-2.5 ${on ? 'border-primary bg-secondary' : 'border-border bg-card'}`}>
              <View className="size-6 rounded-full" style={{ backgroundColor: swatch }} accessibilityElementsHidden importantForAccessibility="no" />
              <Text className="flex-1 font-semibold">{accent.label}</Text>
              <View className={`size-5 items-center justify-center rounded-full border-2 ${on ? 'border-primary' : 'border-border'}`}>{on ? <View className="bg-primary size-2.5 rounded-full" /> : null}</View>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}
