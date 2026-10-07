import { Play } from 'lucide-react-native'
import { View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Progress } from '@/components/ui/progress'
import { Text } from '@/components/ui/text'
import { PressScale } from '@/features/shell/PressScale'
import { continueLearning as c } from './mock'

export function ContinueCard() {
  const primaryFg = String(useCSSVariable('--color-primary-foreground') ?? '#ffffff')
  return (
    <PressScale accessibilityRole="button" accessibilityLabel={`Continue ${c.topic}, ${Math.round(c.progress * 100)} percent complete`}>
      <View className="bg-card border-border flex-row items-center gap-4 rounded-3xl border p-4">
        <View className="flex-1 gap-1.5">
          <Text className="text-muted-foreground text-xs font-medium">{c.subject}</Text>
          <Text className="font-semibold">{c.topic}</Text>
          <Progress value={c.progress * 100} className="mt-1 h-1.5" />
          <Text className="text-muted-foreground text-xs">{Math.round(c.progress * 100)}% complete</Text>
        </View>
        <View className="bg-primary size-12 items-center justify-center rounded-full">
          <Play size={20} color={primaryFg} fill={primaryFg} />
        </View>
      </View>
    </PressScale>
  )
}
