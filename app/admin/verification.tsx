import { useQuery } from '@apollo/client/react'
import { ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Text } from '@/components/ui/text'
import { ScreenHeader } from '@/features/shell/Form'
import { canReviewVerification, ReviewRequests, StudentIdQueue } from '@/features/verification/Verification'
import { ViewerDocument } from '@/graphql/generated/graphql'

/** Proof of study and college ID cards. Platform admins and verified teachers. */
export default function VerificationReview() {
  const insets = useSafeAreaInsets()
  const viewer = useQuery(ViewerDocument).data?.viewer
  const allowed = canReviewVerification(viewer)
  return (
    <View className="bg-background flex-1">
      <ScreenHeader title="Verification to review" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
        {!viewer ? null : allowed ? (
          <>
            <ReviewRequests admin quietForbidden />
            <StudentIdQueue />
          </>
        ) : (
          <Text className="text-muted-foreground py-8 text-center">This is for platform admins and verified teachers.</Text>
        )}
      </ScrollView>
    </View>
  )
}
