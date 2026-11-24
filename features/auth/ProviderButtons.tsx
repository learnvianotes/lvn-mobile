import { View } from 'react-native'
import { useUniwind } from 'uniwind'
import { Text } from '@/components/ui/text'
import { copy } from './copy'
import { GoogleButton } from './GoogleButton'
import { Notice } from './Notice'
import { useGoogleSignIn } from './useGoogleSignIn'

/** Google sign-in (lvn-backend ADR-0007), when this build and the API offer it. GitHub and LinkedIn are retired (ADR-0115). */
export function ProviderButtons() {
  const { theme } = useUniwind()
  const google = useGoogleSignIn()
  if (!google.available) return null
  return (
    <View className="gap-3">
      {google.error ? <Notice>{google.error}</Notice> : null}
      <GoogleButton testID="sign-in-google" tone={theme === 'dark' ? 'light' : 'dark'} busy={google.busy} disabled={google.busy} onPress={() => void google.signIn()} />
      <View className="flex-row items-center gap-3" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View className="bg-border h-px flex-1" />
        <Text className="text-muted-foreground text-xs">{copy.providers.or}</Text>
        <View className="bg-border h-px flex-1" />
      </View>
    </View>
  )
}
