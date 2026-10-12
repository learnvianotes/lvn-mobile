import { ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ScreenHeader } from '@/features/shell/Form'
import { ReviewRequests } from '@/features/verification/Verification'

/** Proof of study for platform admins to check on the phone (lvn-backend ADR-0019). */
export default function VerificationReview() {
  const insets = useSafeAreaInsets()
  return (
    <View className="bg-background flex-1">
      <ScreenHeader title="Proof of study to review" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
        <ReviewRequests admin />
      </ScrollView>
    </View>
  )
}
