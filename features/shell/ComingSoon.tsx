import { View } from 'react-native'
import { SafeAreaView } from '@/components/ui/safe-area-view'
import { Text } from '@/components/ui/text'

/** PROTOTYPE placeholder for tabs that ship with their backend in later phases (spec §20). */
export function ComingSoon({ title, phase }: { title: string; phase: string }) {
  return (
    <SafeAreaView className="bg-background flex-1">
      <View className="flex-1 items-center justify-center gap-2 px-8">
        <Text className="text-2xl font-bold" accessibilityRole="header">{title}</Text>
        <Text className="text-muted-foreground text-center">Arrives in {phase}. This prototype shows the Home tab.</Text>
      </View>
    </SafeAreaView>
  )
}
