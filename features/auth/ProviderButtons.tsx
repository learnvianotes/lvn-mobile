import { useMutation, useQuery } from '@apollo/client/react'
import { useState } from 'react'
import { View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { OAuthExchangeDocument, SignInOptionsDocument, SignInWithGoogleDocument } from '@/graphql/generated/graphql'
import { googleAvailable, googleIdToken } from '@/lib/auth/google'
import { authorize, oauthAvailable } from '@/lib/auth/oauth'
import { copy } from './copy'
import { Notice } from './Notice'
import { useFinishSignIn } from './useFinishSignIn'

type Provider = 'GOOGLE' | 'GITHUB'

/**
 * Google (lvn-backend ADR-0007) and GitHub — each shown only when the API (signInOptions) and this build's
 * configuration both offer it. At launch only Google is configured; GitHub, and LinkedIn once app links exist, come
 * later (mobile addendum → Sign-in).
 */
export function ProviderButtons() {
  const { data } = useQuery(SignInOptionsDocument)
  const [google] = useMutation(SignInWithGoogleDocument)
  const [exchange] = useMutation(OAuthExchangeDocument)
  const finish = useFinishSignIn()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<Provider | null>(null)
  const options = data?.signInOptions
  const show = { GOOGLE: !!options?.google && googleAvailable(), GITHUB: !!options?.github && oauthAvailable('GITHUB') }
  if (!show.GOOGLE && !show.GITHUB) return null

  const signIn = async (provider: Provider) => {
    setError(null)
    setBusy(provider)
    try {
      if (provider === 'GOOGLE') {
        const idToken = await googleIdToken()
        if (!idToken) return
        const { data: res } = await google({ variables: { idToken } })
        const payload = res?.signInWithGoogle
        if (!payload?.session) throw new Error(payload?.userErrors[0]?.message ?? copy.providers.failed)
        await finish(payload.session)
      } else {
        const grant = await authorize(provider)
        if (!grant) return
        const { data: res } = await exchange({ variables: { input: { provider, ...grant } } })
        const payload = res?.oauthExchange
        if (!payload?.session) throw new Error(payload?.userErrors[0]?.message ?? copy.providers.failed)
        await finish(payload.session)
      }
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : copy.providers.failed)
    } finally {
      setBusy(null)
    }
  }

  return (
    <View className="gap-3">
      {error ? <Notice>{error}</Notice> : null}
      {show.GOOGLE ? (
        <Button testID="sign-in-google" variant="outline" size="lg" disabled={!!busy} onPress={() => void signIn('GOOGLE')}>
          <Text>{copy.providers.google}</Text>
        </Button>
      ) : null}
      {show.GITHUB ? (
        <Button variant="outline" size="lg" disabled={!!busy} onPress={() => void signIn('GITHUB')}>
          <Text>{copy.providers.github}</Text>
        </Button>
      ) : null}
      <View className="flex-row items-center gap-3" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View className="bg-border h-px flex-1" />
        <Text className="text-muted-foreground text-xs">{copy.providers.or}</Text>
        <View className="bg-border h-px flex-1" />
      </View>
    </View>
  )
}
