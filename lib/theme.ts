import { useColorScheme } from 'react-native'

/** Brand palette from the LearnViaNotes UI reference — the same tokens as lvn-web's app/globals.css (ADR-0094: blue). */
const light = { bg: '#f6f8fb', surface: '#ffffff', fg: '#111827', muted: '#5b6475', border: '#e3e8ef', accent: '#2563eb', accentFg: '#ffffff', accentSoft: '#eff6ff' }
const dark: typeof light = { bg: '#0d1117', surface: '#161b22', fg: '#f4f4f5', muted: '#a1a1aa', border: '#2d3440', accent: '#60a5fa', accentFg: '#0d1117', accentSoft: '#172554' }

export type Colors = typeof light

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light
}
