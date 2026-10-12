import { getValue, setValue } from '@/features/notes/store/db'

const KEY = 'search.recent'
const MAX = 10

/**
 * Recent searches (lvn-backend ADR-0056, spec §11): the last ten, newest first, kept in the phone's local database —
 * never sent anywhere, and wiped with everything else at sign-out.
 */
export async function recentSearches(): Promise<string[]> {
  try {
    const list = JSON.parse((await getValue(KEY)) ?? '[]') as unknown
    return Array.isArray(list) ? list.filter((q): q is string => typeof q === 'string').slice(0, MAX) : []
  } catch {
    return []
  }
}

/** Puts a search first (once, whatever its case). */
export async function remember(query: string): Promise<string[]> {
  const q = query.trim()
  if (q.length < 2) return recentSearches()
  const list = [q, ...(await recentSearches()).filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, MAX)
  await setValue(KEY, JSON.stringify(list))
  return list
}

/** Removes one search, or all of them. */
export async function forget(query: string | null): Promise<string[]> {
  const list = query === null ? [] : (await recentSearches()).filter((r) => r !== query)
  await setValue(KEY, list.length ? JSON.stringify(list) : null)
  return list
}
