import type { StyleProp, TextStyle } from 'react-native'
import { StyleSheet } from 'react-native'
import { isLoaded } from 'expo-font'

/** Family names passed to `useFonts`. They match the files in the Google font packages. */
export const SANS = {
  400: 'Inter_400Regular',
  500: 'Inter_500Medium',
  600: 'Inter_600SemiBold',
  700: 'Inter_700Bold',
  800: 'Inter_800ExtraBold',
  italic: 'Inter_400Regular_Italic',
} as const

export const MONO = {
  400: 'JetBrainsMono_400Regular',
  500: 'JetBrainsMono_500Medium',
  600: 'JetBrainsMono_600SemiBold',
  700: 'JetBrainsMono_700Bold',
  800: 'JetBrainsMono_700Bold',
  italic: 'JetBrainsMono_400Regular_Italic',
} as const

type Cut = 400 | 500 | 600 | 700 | 800

function cut(weight: number): Cut {
  if (weight >= 750) return 800
  if (weight >= 650) return 700
  if (weight >= 550) return 600
  if (weight >= 450) return 500
  return 400
}

function weightFrom(className: string, flat: TextStyle): number {
  const given = flat.fontWeight
  if (given === 'bold') return 700
  if (typeof given === 'number') return given
  if (typeof given === 'string' && /^\d+$/.test(given)) return Number(given)
  if (/\bfont-extrabold\b/.test(className)) return 800
  if (/\bfont-bold\b/.test(className)) return 700
  if (/\bfont-semibold\b/.test(className)) return 600
  if (/\bfont-medium\b/.test(className)) return 500
  return 400
}

/**
 * Inter for UI and JetBrains Mono for code, once those files have loaded.
 * `fontWeight` is reset so Android does not look for a second face inside the already-weighted file.
 */
export function fontStyleFor(className: string | undefined, style: StyleProp<TextStyle> | undefined, variant?: string | null): TextStyle | undefined {
  if (!isLoaded(SANS[400])) return undefined
  const flat = StyleSheet.flatten(style) ?? {}
  const blob = className ?? ''
  const mono = variant === 'code' || /\bfont-mono\b/.test(blob) || flat.fontFamily === 'monospace'
  const italic = flat.fontStyle === 'italic' || /\bitalic\b/.test(blob)
  const weight = cut(weightFrom(blob, flat))
  const faces = mono ? MONO : SANS
  const fontFamily = italic && weight === 400 ? faces.italic : faces[weight]
  return { fontFamily, fontWeight: 'normal', fontStyle: 'normal' }
}
