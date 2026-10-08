import { z } from 'zod'

const optional = z.string().min(1).optional()

/**
 * Schema for the public app configuration (spec §16.1), validated once at start-up. Mirrors `mobileConfigSchema` in
 * @lvn/contracts/config and is replaced by it once the package is published (lvn-backend ADR-0003, ADR-0006).
 */
const schema = z.object({
  EXPO_PUBLIC_APP_ENV: z.enum(['development', 'sandbox', 'production']),
  /** lvn-web origin, for links into the site (e.g. the study notes at /core). */
  EXPO_PUBLIC_WEB_URL: z.url(),
  /** The GraphQL endpoint of lvn-backend (its gateway, `/graphql`). */
  EXPO_PUBLIC_API_URL: z.url(),
  // GitHub sign-in (Authorization Code + PKCE, §7.1): the public client id and GitHub's consent page. LinkedIn does
  // not redirect to app schemes, so it waits for app links (docs/architecture/mobile-addendum.md → Sign-in).
  EXPO_PUBLIC_GITHUB_CLIENT_ID: optional,
  EXPO_PUBLIC_GITHUB_AUTHORIZE_URL: z.url().optional(),
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
  return result.data
}
