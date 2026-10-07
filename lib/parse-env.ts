import { z } from 'zod'

/**
 * Schema for the public app configuration (spec §16.1), validated once at start-up. Mirrors `mobileConfigSchema` in
 * @lvn/contracts/config and is replaced by it once the package is published (lvn-backend ADR-0003, ADR-0006).
 */
const schema = z.object({
  EXPO_PUBLIC_APP_ENV: z.enum(['development', 'sandbox', 'production']),
  /** lvn-web origin, for links into the site (e.g. the study notes at /core). */
  EXPO_PUBLIC_WEB_URL: z.url(),
})

export function parseEnv(raw: Record<string, string | undefined>) {
  const result = schema.safeParse(raw)
  if (!result.success) {
    const names = result.error.issues.map((i) => i.path.join('.')).join(', ')
    throw new Error(`Invalid app configuration: ${names}`)
  }
  return result.data
}
