import { useQuery } from '@apollo/client/react'
import { ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Text } from '@/components/ui/text'
import { ScreenHeader } from '@/features/shell/Form'
import { ViewerDocument } from '@/graphql/generated/graphql'
import { ModerationQueue } from './ModerationQueue'

/** The platform's moderation queue on the phone, for PLATFORM_ADMIN accounts (spec §15.1, ADR-0037, ADR-0051). */
export function PlatformQueueScreen() {
  const insets = useSafeAreaInsets()
  const viewer = useQuery(ViewerDocument)
  const admin = viewer.data?.viewer?.globalRole === 'PLATFORM_ADMIN'
  return (
    <View className="bg-background flex-1">
      <ScreenHeader title="Moderation queue" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
        {viewer.data && !admin ? <Text className="text-muted-foreground py-16 text-center">The moderation queue is for platform admins.</Text> : null}
        {admin ? <ModerationQueue /> : null}
      </ScrollView>
    </View>
  )
}
