import { applyTheme } from './apply'
import { replacePreference, type ThemeMode, type ThemePreference } from './store'
import { defaultAccentId, listAccents } from './tokens'

/**
 * Same keys and JSON values as the web app's localStorage.
 * `cnote:theme` is `"system"`, `"light"`, or `"dark"`. Missing means System.
 * `cnote:accent` is `"ink"`, `"navy"`, `"teal"`, `"forest"`, `"slate"`, or `"amber"`. Missing means the file default.
 * Native installs this API from expo-sqlite before the root layout reads it. Web already has it.
 * Secure Store cannot use these keys: a colon is not a legal key character there.
 */
export const THEME_KEY = 'cnote:theme'
export const ACCENT_KEY = 'cnote:accent'

type Box = { getItem(key: string): string | null; setItem(key: string, value: string): void }

function box(): Box | null {
  const ls = globalThis.localStorage as Box | undefined
  if (!ls || typeof ls.getItem !== 'function' || typeof ls.setItem !== 'function') return null
  return ls
}

function jsonString(raw: string | null): unknown {
  if (raw == null || raw === '') return undefined
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return undefined
  }
}

function isMode(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark'
}

/** Reads both keys. An unreadable or unknown value falls back without touching the device. */
export function loadThemePreference(): ThemePreference {
  const store = box()
  const accents = listAccents()
  const modeRaw = jsonString(store?.getItem(THEME_KEY) ?? null)
  const accentRaw = jsonString(store?.getItem(ACCENT_KEY) ?? null)
  const accent = typeof accentRaw === 'string' && accents.some((a) => a.id === accentRaw) ? accentRaw : defaultAccentId()
  return { mode: isMode(modeRaw) ? modeRaw : 'system', accent }
}

/** Puts the stored choice into the theme store and onto the screen. Safe to call more than once. */
export function readThemeSync(): ThemePreference {
  const pref = loadThemePreference()
  replacePreference(pref)
  applyTheme()
  return pref
}

export function persistTheme(pref: ThemePreference): void {
  const store = box()
  if (!store) return
  store.setItem(THEME_KEY, JSON.stringify(pref.mode))
  store.setItem(ACCENT_KEY, JSON.stringify(pref.accent))
}
