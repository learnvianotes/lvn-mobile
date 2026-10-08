import { useMutation, useQuery } from '@apollo/client/react'
import { useState } from 'react'
import { View } from 'react-native'
import { useUniwind } from 'uniwind'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { OAuthExchangeDocument, SignInOptionsDocument } from '@/graphql/generated/graphql'
import { authorize, oauthAvailable } from '@/lib/auth/oauth'
import { copy } from './copy'
import { GoogleButton } from './GoogleButton'
import { Notice } from './Notice'
import { useFinishSignIn } from './useFinishSignIn'
import { useGoogleSignIn } from './useGoogleSignIn'

/**
 * Google (lvn-backend ADR-0007) and GitHub — each shown only when the API (signInOptions) and this build's
 * configuration both offer it. At launch only Google is configured; GitHub, and LinkedIn once app links exist, come
 * later (mobile addendum → Sign-in).
 */
export function ProviderButtons() {
  const { theme } = useUniwind()
  const google = useGoogleSignIn()
  const { data } = useQuery(SignInOptionsDocument)
  const [exchange] = useMutation(OAuthExchangeDocument)
  const finish = useFinishSignIn()
  const [githubError, setGithubError] = useState<string | null>(null)
  const [githubBusy, setGithubBusy] = useState(false)
  const showGithub = !!data?.signInOptions.github && oauthAvailable('GITHUB')
  if (!google.available && !showGithub) return null

  const signInWithGithub = async () => {
    setGithubError(null)
    setGithubBusy(true)
    try {
      const grant = await authorize('GITHUB')
      if (!grant) return
      const { data: res } = await exchange({ variables: { input: { provider: 'GITHUB', ...grant } } })
      const payload = res?.oauthExchange
      if (!payload?.session) throw new Error(payload?.userErrors[0]?.message ?? copy.providers.failed)
      await finish(payload.session)
    } catch (e) {
      setGithubError(e instanceof Error && e.message ? e.message : copy.providers.failed)
    } finally {
      setGithubBusy(false)
    }
  }

  const busy = google.busy || githubBusy
  const error = google.error ?? githubError
  return (
    <View className="gap-3">
      {error ? <Notice>{error}</Notice> : null}
      {google.available ? (
        <GoogleButton testID="sign-in-google" tone={theme === 'dark' ? 'light' : 'dark'} busy={google.busy} disabled={busy} onPress={() => void google.signIn()} />
      ) : null}
      {showGithub ? (
        <Button variant="outline" size="lg" disabled={busy} onPress={() => void signInWithGithub()}>
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
