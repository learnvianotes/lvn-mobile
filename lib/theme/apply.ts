import { Appearance } from 'react-native'
import { Uniwind } from 'uniwind'
import { cssVariables } from './css'
import { getTheme, setSystemScheme, subscribeTheme } from './store'
import { resolvePalette } from './tokens'

/**
 * Pushes both palettes into Uniwind, then selects the theme.
 *
 * React Native 0.88: `Uniwind.setTheme('light' | 'dark')` calls `Appearance.setColorScheme`
 * and locks the app to that scheme, including the status bar. That is what an explicit Light
 * or Dark choice should do. System must pass `'system'`, which resets the override to `'auto'`
 * so the device appearance keeps driving Uniwind and `useColorScheme`. Passing the resolved
 * light or dark value would freeze System on whatever scheme was active when it was selected.
 */
export function applyTheme(): void {
  const { accent, scheme, mode } = getTheme()
  const light = cssVariables(resolvePalette('light', accent))
  const dark = cssVariables(resolvePalette('dark', accent))
  try {
    Uniwind.updateCSSVariables('light', light)
    Uniwind.updateCSSVariables('dark', dark)
    Uniwind.setTheme(mode === 'system' ? 'system' : scheme)
  } catch {
    // Themes are not registered until Metro boots. useTheme still has the palette.
  }
  if (mode !== 'system') return
  // setTheme('system') reads the scheme before it clears a previous override, so read again.
  const device = Appearance.getColorScheme()
  if (device === 'light' || device === 'dark') setSystemScheme(device)
}

export function watchTheme(): () => void {
  applyTheme()
  return subscribeTheme(() => applyTheme())
}
