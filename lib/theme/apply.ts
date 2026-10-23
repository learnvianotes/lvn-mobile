import { Uniwind } from 'uniwind'
import { cssVariables } from './css'
import { getTheme, subscribeTheme } from './store'
import { resolvePalette } from './tokens'

/** Pushes the resolved light and dark palettes into Uniwind, then selects the active scheme. */
export function applyTheme(): void {
  const { accent, scheme } = getTheme()
  const light = cssVariables(resolvePalette('light', accent))
  const dark = cssVariables(resolvePalette('dark', accent))
  try {
    Uniwind.updateCSSVariables('light', light)
    Uniwind.updateCSSVariables('dark', dark)
    Uniwind.setTheme(scheme)
  } catch {
    // Themes are not registered until Metro boots. useTheme still has the palette.
  }
}

export function watchTheme(): () => void {
  applyTheme()
  return subscribeTheme(() => applyTheme())
}
