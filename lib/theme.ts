import { useColorScheme } from 'react-native'

/** Same tokens as lvn-web's globals.css, so both apps read as one product. */
const light = { bg: '#f7f7f8', surface: '#ffffff', fg: '#18181b', muted: '#5f5f6b', border: '#e4e4e9', accent: '#1d4ed8', accentFg: '#ffffff', accentSoft: '#e8efff' }
const dark: typeof light = { bg: '#0e0e10', surface: '#17171a', fg: '#f4f4f5', muted: '#a1a1aa', border: '#2c2c33', accent: '#6c9cff', accentFg: '#0e0e10', accentSoft: '#1b2540' }

export type Colors = typeof light

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light
}
