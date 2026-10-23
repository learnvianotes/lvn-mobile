import { Appearance } from 'react-native'
import { defaultAccentId, listAccents, resolvePalette, type Appearance as Scheme, type Palette } from './tokens'

export type ThemeMode = 'system' | Scheme

export interface ThemePreference {
  mode: ThemeMode
  accent: string
}

export interface ThemeSnapshot {
  mode: ThemeMode
  accent: string
  scheme: Scheme
  palette: Palette
  accents: { id: string; label: string }[]
}

let system: Scheme = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'
let pref: ThemePreference = { mode: 'system', accent: defaultAccentId() }
const listeners = new Set<() => void>()

function snapshot(): ThemeSnapshot {
  const accents = listAccents()
  const accent = accents.some((a) => a.id === pref.accent) ? pref.accent : (accents[0]?.id ?? 'navy')
  const scheme: Scheme = pref.mode === 'system' ? system : pref.mode
  return { mode: pref.mode, accent, scheme, palette: resolvePalette(scheme, accent), accents }
}

let current = snapshot()

function emit(): void {
  current = snapshot()
  listeners.forEach((l) => l())
}

export function getTheme(): ThemeSnapshot {
  return current
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setSystemScheme(next: Scheme): void {
  if (system === next) return
  system = next
  emit()
}

export function setThemePreference(next: Partial<ThemePreference>): void {
  pref = { ...pref, ...next }
  emit()
}

export function replacePreference(next: ThemePreference): void {
  pref = { ...next }
  emit()
}
