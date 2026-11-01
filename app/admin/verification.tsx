import { ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ScreenHeader } from '@/features/shell/Form'
import { ReviewRequests, StudentIdQueue } from '@/features/verification/Verification'

/**
 * Proof of study and college ID cards. Platform admins, managers and teachers; the API returns only what that role may decide.
 */
export default function VerificationReview() {
  const insets = useSafeAreaInsets()
  return (
    <View className="bg-background flex-1">
      <ScreenHeader title="Verification to review" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
        <ReviewRequests admin quietForbidden />
        <StudentIdQueue />
      </ScrollView>
    </View>
  )
}
