import { router } from 'expo-router'
import { Play } from 'lucide-react-native'
import { View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { PressScale } from '@/features/shell/PressScale'
import type { RecommendationsQuery } from '@/graphql/generated/graphql'

/** The note the person was reading (lvn-backend ADR-0071: a CONTINUE_NOTE recommendation), one tap away. */
export function ContinueCard({ item }: { item: RecommendationsQuery['recommendations'][number] }) {
  const primaryFg = String(useCSSVariable('--color-primary-foreground') ?? '#ffffff')
  const title = item.noteTitle || 'Untitled note'
  return (
    <PressScale accessibilityRole="button" accessibilityLabel={`Continue ${title}. ${item.reason}`} onPress={() => item.note && router.push(`/notes/${item.note.id}`)}>
      <View className="bg-card border-border flex-row items-center gap-4 rounded-3xl border p-4">
        <View className="flex-1 gap-1.5">
          <Text className="font-semibold" numberOfLines={2}>
            {title}
          </Text>
          <Text className="text-muted-foreground text-xs">{item.reason}</Text>
        </View>
        <View className="bg-primary size-12 items-center justify-center rounded-full">
          <Play size={20} color={primaryFg} fill={primaryFg} />
        </View>
      </View>
    </PressScale>
  )
}
