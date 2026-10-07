import { useColorScheme } from 'react-native'

/** Brand palette from the LearnViaNotes UI reference — the same tokens as lvn-web's app/globals.css. */
const light = { bg: '#f7f7fb', surface: '#ffffff', fg: '#1e1b2e', muted: '#5f5f73', border: '#e6e6ef', accent: '#4f46e5', accentFg: '#ffffff', accentSoft: '#eef2ff' }
const dark: typeof light = { bg: '#0e0e12', surface: '#17171c', fg: '#f4f4f5', muted: '#a1a1aa', border: '#2c2c35', accent: '#818cf8', accentFg: '#0e0e12', accentSoft: '#1e1b4b' }

export type Colors = typeof light

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light
}
