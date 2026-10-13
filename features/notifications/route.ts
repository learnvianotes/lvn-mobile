/**
 * Where a notification opens on the phone: the API's path, except what lives in Settings here (lvn-backend ADR-0076):
 * a data export or an import points at the account (/profile on the web), which on the phone is behind the gear.
 */
export function phonePath(path: string, category?: unknown): string {
  if (path === '/profile' && (category === 'DATA_EXPORT' || category === 'NOTES_IMPORT')) return '/settings'
  return path
}
