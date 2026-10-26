import { useSyncExternalStore } from 'react'
import { persistTheme } from './persist'
import { getTheme, setThemePreference, subscribeTheme, type ThemeMode, type ThemeSnapshot } from './store'

export type { ThemeMode, ThemePreference, ThemeSnapshot } from './store'
export type { Appearance, Palette } from './tokens'
export { listAccents, resolvePalette, defaultAccentId } from './tokens'

export function useTheme(): ThemeSnapshot {
  return useSyncExternalStore(subscribeTheme, getTheme, getTheme)
}

/** The small palette older screens asked for. Values come from the active accent. */
export function useColors() {
  const { palette } = useTheme()
  return {
    bg: palette.paper,
    surface: palette.surface,
    fg: palette.ink,
    muted: palette.inkMuted,
    border: palette.line,
    accent: palette.brand,
    accentFg: palette.brandForeground,
    accentSoft: palette.brandSoft,
  }
}

export type Colors = ReturnType<typeof useColors>

function remember(): void {
  const { mode, accent } = getTheme()
  void persistTheme({ mode, accent })
}

export function chooseMode(mode: ThemeMode): void {
  setThemePreference({ mode })
  remember()
}

export function chooseAccent(accent: string): void {
  setThemePreference({ accent })
  remember()
}

