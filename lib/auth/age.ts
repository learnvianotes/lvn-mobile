import * as SecureStore from 'expo-secure-store'

/**
 * Accounts start at age 13 (`AGE_MIN` in `./forms`, the floor the API enforces — lvn-backend ADR-0091; it was 8, and
 * before that 18). Ages 13 to 17 join as a restricted account, with no parent or guardian step. The forms ask for an
 * age in whole years (ADR-0104). The API decides again.
 * This module keeps what the app needs:
 * - which answers are a refusal: `AGE_RESTRICTED`, and `UNDER_MINIMUM_AGE` from an API older than 2026-10-25;
 * - a refusal is remembered on this device for a day, so going back and answering again doesn't reopen sign-up. It
 *   closes the sign-up forms and nothing else: it never deletes or signs out anyone;
 * - the age in words, for the "Is this right?" step every answer goes through.
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

/**
 * Whether the API refused an account for its age. Since lvn-backend's 2026-10-25 change it keeps that account on hold
 * (`AGE_BLOCKED`) with no session, and the code is `AGE_RESTRICTED`.
 */
export function isAgeRefusal(problem: { code: string }): boolean {
  return problem.code === 'AGE_RESTRICTED' || problem.code === 'UNDER_MINIMUM_AGE'
}

/** "17 years old" ("1 year old"), so a mis-typed age is easy to see. */
export function ageInWords(age: number): string {
  return age === 1 ? '1 year old' : `${age} years old`
}
