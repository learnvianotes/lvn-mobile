import { LinearGradient } from 'expo-linear-gradient'
import { BrainCircuit, Network, Waypoints } from 'lucide-react-native'
import { ScrollView, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { PressScale } from '@/features/shell/PressScale'
import { recommended } from './mock'

const ICONS = { graph: Waypoints, brain: BrainCircuit, network: Network }
const TONES = {
  primary: ['#4f46e5', '#7c3aed'],
  sky: ['#0284c7', '#4f46e5'],
  warm: ['#ea580c', '#db2777'],
} as const

/** Recommendations always say why (§14.3, ADR-0026). */
export function Recommended() {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }} style={{ marginHorizontal: -20 }}>
      {recommended.map((r) => {
        const Icon = ICONS[r.icon]
        return (
          <PressScale key={r.title} accessibilityRole="button" accessibilityLabel={`${r.title}, ${r.subject}. ${r.reason}`}>
            <View className="bg-card border-border w-44 overflow-hidden rounded-3xl border">
              <LinearGradient colors={[...TONES[r.tone]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 88, alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={34} color="#ffffff" />
              </LinearGradient>
              <View className="gap-1 p-3">
                <Text className="font-semibold" numberOfLines={1}>{r.title}</Text>
                <Text className="text-muted-foreground text-xs">{r.subject}</Text>
                <Text className="text-primary text-xs" numberOfLines={2}>{r.reason}</Text>
              </View>
            </View>
          </PressScale>
        )
      })}
    </ScrollView>
  )
}
