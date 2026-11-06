import { inAppPath } from '@/lib/safe-url'

/**
 * Where a notification opens on the phone: the API's path, except what lives in Settings here (lvn-backend ADR-0076):
 * a data export or an import points at the account (/profile on the web), which on the phone is behind the gear.
 * Anything that is not an in-app path is dropped. `router.push` would otherwise open `intent:`, `file:` or `//host`
 * with the OS.
 */
export function phonePath(path: string, category?: unknown): string | null {
  const safe = inAppPath(path)
  if (!safe) return null
  if (safe === '/profile' && (category === 'DATA_EXPORT' || category === 'NOTES_IMPORT')) return '/settings'
  return safe
}
