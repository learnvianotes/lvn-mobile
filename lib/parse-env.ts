import { z } from 'zod'

const optional = z.string().min(1).optional()
/** A web address. `javascript:` and `intent:` are URLs to Zod, and they are not configuration. */
const httpAddress = z.url().refine((u) => /^https?:\/\//.test(u), 'must be an http(s) URL')

/**
 * Schema for the public app configuration (spec §16.1), validated once at start-up. Mirrors `mobileConfigSchema` in
 * @lvn/contracts/config and is replaced by it once the package is published (lvn-backend ADR-0003, ADR-0006).
 */
const schema = z.object({
  EXPO_PUBLIC_APP_ENV: z.enum(['development', 'sandbox', 'production']),
  /** lvn-web origin, for links into the site (e.g. the study notes at /core). */
  EXPO_PUBLIC_WEB_URL: httpAddress,
  /** The GraphQL endpoint of lvn-backend (its gateway, `/graphql`). */
  EXPO_PUBLIC_API_URL: httpAddress,
  /** Live updates while the app is open, lvn-backend's graphql-ws endpoint (ADR-0042); see `liveUrlFrom`. */
  EXPO_PUBLIC_LIVE_URL: z.url().refine((u) => /^wss?:\/\//.test(u), 'must be a ws(s) URL').optional(),
  // GitHub sign-in (Authorization Code + PKCE, §7.1): the public client id and GitHub's consent page. LinkedIn does
  // not redirect to app schemes, so it waits for app links (docs/architecture/mobile-addendum.md → Sign-in).
  EXPO_PUBLIC_GITHUB_CLIENT_ID: optional,
  EXPO_PUBLIC_GITHUB_AUTHORIZE_URL: httpAddress.optional(),
  // Google sign-in (ADR-0007): the Firebase web app's config and the OAuth client ids of that Firebase project's
  // Google provider. Public identifiers, not secrets.
  EXPO_PUBLIC_FIREBASE_API_KEY: optional,
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: optional,
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: optional,
  EXPO_PUBLIC_FIREBASE_APP_ID: optional,
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: optional,
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: optional,
  /** Sentry for crashes and unexpected errors (§16.5); off without it. */
  EXPO_PUBLIC_SENTRY_DSN: z.url().refine((u) => /^https?:\/\//.test(u), 'must be an http(s) URL').optional(),
})

export type AppEnv = z.infer<typeof schema>

export function parseEnv(raw: Record<string, string | undefined>): AppEnv {
  // An empty value in env/<variant>.env means "not set".
  const result = schema.safeParse(Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== '')))
  if (!result.success) {
    const names = result.error.issues.map((i) => i.path.join('.')).join(', ')
    throw new Error(`Invalid app configuration: ${names}`)
  }
  // Development talks to a machine on the LAN over http. Sandbox and production do not.
  if (result.data.EXPO_PUBLIC_APP_ENV !== 'development') {
    const cleartext = [
      result.data.EXPO_PUBLIC_WEB_URL.startsWith('https://') ? null : 'EXPO_PUBLIC_WEB_URL',
      result.data.EXPO_PUBLIC_API_URL.startsWith('https://') ? null : 'EXPO_PUBLIC_API_URL',
      !result.data.EXPO_PUBLIC_LIVE_URL || result.data.EXPO_PUBLIC_LIVE_URL.startsWith('wss://') ? null : 'EXPO_PUBLIC_LIVE_URL',
    ].filter((name) => name != null)
    if (cleartext.length) throw new Error(`Invalid app configuration: ${cleartext.join(', ')}`)
  }
  return result.data
}

/**
 * Where live updates come from (lvn-backend ADR-0042): EXPO_PUBLIC_LIVE_URL, or in development the API's own
 * `/graphql/live` next to EXPO_PUBLIC_API_URL. Null elsewhere without it: the app then has no live updates.
 */
export function liveUrlFrom(e: Pick<AppEnv, 'EXPO_PUBLIC_APP_ENV' | 'EXPO_PUBLIC_API_URL' | 'EXPO_PUBLIC_LIVE_URL'>): string | null {
  if (e.EXPO_PUBLIC_LIVE_URL) return e.EXPO_PUBLIC_LIVE_URL
  if (e.EXPO_PUBLIC_APP_ENV !== 'development') return null
  return `${e.EXPO_PUBLIC_API_URL.replace(/^http/, 'ws').replace(/\/$/, '')}/live`
}
