import { useMutation, useQuery } from '@apollo/client/react'
import { useState } from 'react'
import { View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { OAuthExchangeDocument, SignInOptionsDocument } from '@/graphql/generated/graphql'
import { authorize, oauthAvailable, type OAuthProvider } from '@/lib/auth/oauth'
import { copy } from './copy'
import { Notice } from './Notice'
import { useFinishSignIn } from './useFinishSignIn'

/**
 * GitHub, shown when the API (signInOptions) and this build's configuration both offer it. Google joins it once the
 * Firebase project's Android and iOS apps exist (lvn-backend ADR-0007), LinkedIn once app links do (mobile addendum →
 * Sign-in).
 */
export function ProviderButtons() {
  const { data } = useQuery(SignInOptionsDocument)
  const [exchange] = useMutation(OAuthExchangeDocument)
  const finish = useFinishSignIn()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<OAuthProvider | null>(null)
  const options = data?.signInOptions
  if (!options?.github || !oauthAvailable('GITHUB')) return null

  const start = async (provider: OAuthProvider) => {
    setError(null)
    setBusy(provider)
    try {
      const grant = await authorize(provider)
      if (!grant) return
      const { data: res } = await exchange({ variables: { input: { provider, ...grant } } })
      const payload = res?.oauthExchange
      if (!payload?.session) throw new Error(payload?.userErrors[0]?.message ?? copy.providers.failed)
      await finish(payload.session)
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : copy.providers.failed)
    } finally {
      setBusy(null)
    }
  }

  return (
    <View className="gap-3">
      {error ? <Notice>{error}</Notice> : null}
      <Button variant="outline" size="lg" disabled={!!busy} onPress={() => void start('GITHUB')}>
        <Text>{copy.providers.github}</Text>
      </Button>
      <View className="flex-row items-center gap-3" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View className="bg-border h-px flex-1" />
        <Text className="text-muted-foreground text-xs">{copy.providers.or}</Text>
        <View className="bg-border h-px flex-1" />
      </View>
    </View>
  )
}
