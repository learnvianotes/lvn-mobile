import { Bell, Search } from 'lucide-react-native'
import { View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Wordmark } from '@/components/brand/Logo'
import { Text } from '@/components/ui/text'
import { PressScale } from '@/features/shell/PressScale'

export function HomeHeader() {
  const fg = String(useCSSVariable('--color-foreground') ?? '#1e1b2e')
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#5f5f73')
  return (
    <View className="gap-4">
      <View className="flex-row items-center justify-between">
        <Wordmark size={34} />
        <View className="flex-row items-center gap-2">
          <PressScale accessibilityRole="button" accessibilityLabel="Notifications, 2 new" hitSlop={8}>
            <View className="bg-card border-border size-10 items-center justify-center rounded-full border">
              <Bell size={20} color={fg} />
              <View className="bg-rose absolute right-2 top-2 size-2 rounded-full" />
            </View>
          </PressScale>
          <View className="bg-secondary size-10 items-center justify-center rounded-full">
            <Text className="text-secondary-foreground font-bold">M</Text>
          </View>
        </View>
      </View>
      <PressScale feedback="none" accessibilityRole="search" accessibilityLabel="Search notes, topics and people">
        <View className="bg-card border-border h-12 flex-row items-center gap-3 rounded-2xl border px-4">
          <Search size={18} color={muted} />
          <Text className="text-muted-foreground text-sm">Search notes, topics, people…</Text>
        </View>
      </PressScale>
    </View>
  )
}
