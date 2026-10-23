import { useEffect, useRef, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import { watchTheme } from './apply'
import { useBrandFonts } from './loadFonts'
import { readThemeSync } from './persist'
import { setSystemScheme } from './store'

/**
 * Applies the saved mode and accent before children render, so the first frame is not the default Navy
 * when the device already has another choice. System follows the OS and ignores an unknown scheme.
 * Inter and JetBrains Mono load before that frame too; a failed load keeps the system font.
 */
export function ThemeRoot({ children }: { children: ReactNode }) {
  const scheme = useColorScheme()
  const fontsReady = useBrandFonts()
  const ready = useRef(false)
  if (!ready.current) {
    readThemeSync()
    ready.current = true
  }
  useEffect(() => {
    if (scheme !== 'light' && scheme !== 'dark') return
    setSystemScheme(scheme)
  }, [scheme])
  useEffect(() => watchTheme(), [])
  if (!fontsReady) return null
  return children
}
