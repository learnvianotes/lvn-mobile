import file from '@/docs/ui-revamp/tokens.json'

/**
 * Theme resolution for docs/ui-revamp/tokens.json (the web file, version 2).
 *
 * `color.base.light` and `color.base.dark` are the shared paper, ink, and status colours.
 * `color.themes[id].light|dark` override the brand slots for that accent. Nothing here hard-codes a swatch.
 * An older file may still use `color.light` / `color.dark` and a top-level `themes` table.
 */

export type Appearance = 'light' | 'dark'

export interface Palette {
  paper: string
  surface: string
  surfaceMuted: string
  ink: string
  inkSecondary: string
  inkMuted: string
  line: string
  lineStrong: string
  brand: string
  brandHover: string
  brandForeground: string
  brandSoft: string
  success: string
  successSoft: string
  warning: string
  warningSoft: string
  danger: string
  dangerSoft: string
  info: string
  infoSoft: string
  inverse: string
  inverseInk: string
  inverseMuted: string
  highlight: string
  codeKeyword: string
  codeString: string
  codeNumber: string
  codeTitle: string
}

type PartialPalette = Partial<Palette>

interface ThemeEntry {
  label?: string
  name?: string
  light?: PartialPalette
  dark?: PartialPalette
  color?: { light?: PartialPalette; dark?: PartialPalette }
}

export interface TokensFile {
  appearance?: { defaultMode?: string; defaultAccent?: string; accents?: string[] }
  color?: {
    light?: PartialPalette
    dark?: PartialPalette
    base?: { light?: PartialPalette; dark?: PartialPalette }
    themes?: Record<string, ThemeEntry>
  }
  accent?: { default?: string; themes?: Record<string, ThemeEntry> }
  themes?: Record<string, ThemeEntry>
}

const bundled = file as TokensFile

export function themeTable(source: TokensFile = bundled): Record<string, ThemeEntry> {
  return source.color?.themes ?? source.accent?.themes ?? source.themes ?? {}
}

function labelize(id: string): string {
  return id.slice(0, 1).toUpperCase() + id.slice(1)
}

export function listAccents(source: TokensFile = bundled): { id: string; label: string }[] {
  const table = themeTable(source)
  const named = source.appearance?.accents?.filter((id) => table[id])
  const ids = named?.length ? named : Object.keys(table)
  if (!ids.length) return [{ id: 'navy', label: 'Navy' }]
  return ids.map((id) => ({ id, label: table[id]?.name?.trim() || table[id]?.label?.trim() || labelize(id) }))
}

export function defaultAccentId(source: TokensFile = bundled): string {
  const listed = listAccents(source)
  const asked = source.appearance?.defaultAccent ?? source.accent?.default
  if (asked && listed.some((a) => a.id === asked)) return asked
  return listed[0]?.id ?? 'navy'
}

/** Base palette for `appearance`, with the named accent's brand overrides merged on top. Unknown ids use the default accent. */
export function resolvePalette(appearance: Appearance, accentId: string, source: TokensFile = bundled): Palette {
  const base = { ...(source.color?.base?.[appearance] ?? source.color?.[appearance] ?? {}) }
  const table = themeTable(source)
  const fallbackId = defaultAccentId(source)
  const chosen = table[accentId] ?? table[fallbackId]
  const over = chosen?.[appearance] ?? chosen?.color?.[appearance] ?? {}
  return { ...base, ...over } as Palette
}

export const tokens = bundled
