import * as AuthSession from 'expo-auth-session'
import { env } from '@/lib/env'

/**
 * Providers the app can sign in with through `oauthExchange`. LinkedIn is not one yet: it only redirects to http(s)
 * URLs, never to an app scheme, so it needs app links or a redirect page on lvn-web first (mobile addendum → Sign-in).
 */
export type OAuthProvider = 'GITHUB'

const SCOPES: Record<OAuthProvider, string[]> = { GITHUB: ['read:user', 'user:email'] }

/**
 * `<variant scheme>://oauth/callback` — registered with GitHub and listed in the API's OAUTH_REDIRECT_URIS.
 * app/+native-intent.ts keeps the router from opening it as a screen.
 */
export const redirectUri = () => AuthSession.makeRedirectUri({ path: 'oauth/callback' })

const config = (_provider: OAuthProvider) => ({ clientId: env.EXPO_PUBLIC_GITHUB_CLIENT_ID, authorizationEndpoint: env.EXPO_PUBLIC_GITHUB_AUTHORIZE_URL })

export function oauthAvailable(provider: OAuthProvider): boolean {
  const { clientId, authorizationEndpoint } = config(provider)
  return !!(clientId && authorizationEndpoint)
}

/**
 * Authorization Code + PKCE (§7.1) in the system's auth browser (Custom Tabs, ASWebAuthenticationSession).
 * expo-auth-session generates the verifier and a random state and refuses a redirect whose state does not match.
 * Returns what `oauthExchange` needs, or null when the person closed the browser.
 */
export async function authorize(provider: OAuthProvider): Promise<{ code: string; codeVerifier: string; redirectUri: string } | null> {
  const { clientId, authorizationEndpoint } = config(provider)
  if (!clientId || !authorizationEndpoint) throw new Error(`${provider} sign-in is not configured`)
  const uri = redirectUri()
  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri: uri,
    scopes: SCOPES[provider],
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
  })
  const result = await request.promptAsync({ authorizationEndpoint })
  if (result.type === 'cancel' || result.type === 'dismiss') return null
  if (result.type !== 'success' || !result.params.code || !request.codeVerifier) throw new Error(result.type === 'error' ? (result.error?.message ?? 'denied') : result.type)
  return { code: result.params.code, codeVerifier: request.codeVerifier, redirectUri: uri }
}
