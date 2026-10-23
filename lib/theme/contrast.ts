/** WCAG relative luminance and contrast. Used to keep every accent on AA for text. */

function channel(hex: string, i: number): number {
  const n = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255
  return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4
}

export function luminance(hex: string): number {
  const h = hex.trim().toLowerCase()
  const r = channel(h, 0)
  const g = channel(h, 1)
  const b = channel(h, 2)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(foreground: string, background: string): number {
  const a = luminance(foreground)
  const b = luminance(background)
  const [hi, lo] = a > b ? [a, b] : [b, a]
  return (hi + 0.05) / (lo + 0.05)
}

/** Normal text needs 4.5:1. Large text (18px bold or 24px) needs 3:1. */
export function meetsAA(foreground: string, background: string, large = false): boolean {
  return contrastRatio(foreground, background) >= (large ? 3 : 4.5)
}

/**
 * Purple, violet, indigo, magenta and pink sit in this hue band once the colour is saturated.
 * Navy and slate sit well below it. Gray (low chroma) is allowed.
 */
export function isDisallowedHue(hex: string): boolean {
  const h = hex.trim().toLowerCase()
  const r = parseInt(h.slice(1, 3), 16) / 255
  const g = parseInt(h.slice(3, 5), 16) / 255
  const b = parseInt(h.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  if (d < 0.12 || max === 0) return false
  let hue: number
  if (max === r) hue = ((g - b) / d) % 6
  else if (max === g) hue = (b - r) / d + 2
  else hue = (r - g) / d + 4
  hue *= 60
  if (hue < 0) hue += 360
  const sat = d / max
  return sat > 0.28 && hue >= 265 && hue <= 345
}
