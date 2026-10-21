import * as SecureStore from 'expo-secure-store'

/**
 * Accounts are for adults (lvn-backend ADR-0091). The API decides — the forms never name the cut-off — and this module
 * keeps what the app needs:
 * - a refusal is remembered on this device for a day, so going back and answering again doesn't reopen sign-up. It
 *   closes the sign-up forms and nothing else: it never deletes or signs out anyone;
 * - the date of birth in words, for the "Is this right?" step every answer goes through.
 */

const KEY = 'lvn.ageRefused'
export const REFUSED_FOR_MS = 24 * 60 * 60 * 1000

const listeners = new Set<() => void>()

/** Remembers a refusal on this device. */
export async function markAgeRefused(now = Date.now()): Promise<void> {
  await SecureStore.setItemAsync(KEY, String(now)).catch(() => undefined)
  listeners.forEach((l) => l())
}

/** When this device was refused, while that is under a day ago; otherwise null (and an old record is cleared). */
export async function ageRefusedAt(now = Date.now()): Promise<number | null> {
  const raw = await SecureStore.getItemAsync(KEY).catch(() => null)
  const at = raw === null ? NaN : Number(raw)
  if (!Number.isFinite(at)) return null
  if (now - at < REFUSED_FOR_MS && at <= now) return at
  await SecureStore.deleteItemAsync(KEY).catch(() => undefined)
  return null
}

export function subscribeAgeRefusal(listener: () => void): () => void {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** "14 March 2001" from `YYYY-MM-DD` — so a mis-typed day, month or year is easy to see. Empty for anything else. */
export function birthDateInWords(iso: string | null): string {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return ''
  const [, y, mo, d] = m
  return `${Number(d)} ${MONTHS[Number(mo) - 1] ?? ''} ${y}`
}
