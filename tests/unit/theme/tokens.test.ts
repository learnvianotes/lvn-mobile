import { contrastRatio, isDisallowedHue, meetsAA } from '@/lib/theme/contrast'
import { cssVariables } from '@/lib/theme/css'
import { ACCENT_KEY, loadThemePreference, persistTheme, readThemeSync, THEME_KEY } from '@/lib/theme/persist'
import { getTheme } from '@/lib/theme/store'
import { defaultAccentId, listAccents, resolvePalette, type Appearance, type TokensFile } from '@/lib/theme/tokens'

const PAIRS: [string, string][] = [
  ['brandForeground', 'brand'],
  ['brand', 'paper'],
  ['brand', 'surface'],
  ['brand', 'brandSoft'],
  ['ink', 'paper'],
  ['inkMuted', 'paper'],
  ['inverseInk', 'inverse'],
  ['inverseMuted', 'inverse'],
]

describe('tokens.json', () => {
  it('ships Navy, Teal, Forest, Slate and Amber, with Navy as the default and System-ready base', () => {
    expect(defaultAccentId()).toBe('navy')
    expect(listAccents().map((a) => a.label)).toEqual(['Navy', 'Teal', 'Forest', 'Slate', 'Amber'])
    expect(resolvePalette('light', 'navy').brand).toBe('#1e4d8c')
    expect(resolvePalette('dark', 'navy').brand).toBe('#9dc0ea')
    expect(resolvePalette('light', 'teal').brand).toBe('#0f5f6b')
    expect(resolvePalette('light', 'missing').brand).toBe('#1e4d8c')
  })

  it('keeps every accent on AA and out of the purple and pink hue band', () => {
    for (const accent of listAccents()) {
      for (const appearance of ['light', 'dark'] as Appearance[]) {
        const palette = resolvePalette(appearance, accent.id)
        for (const [fg, bg] of PAIRS) {
          const front = palette[fg as keyof typeof palette]
          const back = palette[bg as keyof typeof palette]
          expect({ accent: accent.id, appearance, fg, bg, ratio: contrastRatio(front, back) }).toEqual(
            expect.objectContaining({ ratio: expect.any(Number) }),
          )
          expect(meetsAA(front, back)).toBe(true)
        }
        for (const value of Object.values(palette)) {
          expect(isDisallowedHue(value)).toBe(false)
        }
      }
    }
  })

  it('reads a swapped file: base plus partial overrides, or a themes table without accent', () => {
    const swapped: TokensFile = {
      color: { light: { paper: '#ffffff', brand: '#111111', ink: '#111111' }, dark: { paper: '#000000', brand: '#eeeeee', ink: '#eeeeee' } },
      themes: { slate: { label: 'Slate', light: { brand: '#222222' }, dark: { brand: '#dddddd' } } },
    }
    expect(listAccents(swapped)).toEqual([{ id: 'slate', label: 'Slate' }])
    expect(resolvePalette('light', 'slate', swapped).brand).toBe('#222222')
    expect(resolvePalette('light', 'slate', swapped).paper).toBe('#ffffff')
    expect(resolvePalette('dark', 'navy', swapped).brand).toBe('#dddddd')
  })

  it('maps the palette onto the CSS variables the screens already use, and rose is danger', () => {
    const vars = cssVariables(resolvePalette('light', 'forest'))
    expect(vars['--color-primary']).toBe('#0f6b45')
    expect(vars['--color-background']).toBe('#f4f6f8')
    expect(vars['--color-rose']).toBe('#9f1d1d')
    expect(vars['--color-rose-soft']).toBe('#fdecec')
  })
})

describe('theme preference', () => {
  afterEach(() => {
    localStorage.removeItem(THEME_KEY)
    localStorage.removeItem(ACCENT_KEY)
  })

  it('stores cnote:theme and cnote:accent as JSON, and drops an accent the file no longer has', () => {
    persistTheme({ mode: 'dark', accent: 'amber' })
    expect(localStorage.getItem(THEME_KEY)).toBe('"dark"')
    expect(localStorage.getItem(ACCENT_KEY)).toBe('"amber"')
    expect(loadThemePreference()).toEqual({ mode: 'dark', accent: 'amber' })
    localStorage.setItem(ACCENT_KEY, JSON.stringify('violet'))
    expect(loadThemePreference()).toEqual({ mode: 'dark', accent: 'navy' })
    localStorage.setItem(THEME_KEY, 'not-json')
    expect(loadThemePreference()).toEqual({ mode: 'system', accent: 'navy' })
    localStorage.removeItem(THEME_KEY)
    localStorage.removeItem(ACCENT_KEY)
    expect(loadThemePreference()).toEqual({ mode: 'system', accent: 'navy' })
  })

  it('applies the stored choice before a screen can render the default', () => {
    localStorage.setItem(THEME_KEY, JSON.stringify('dark'))
    localStorage.setItem(ACCENT_KEY, JSON.stringify('forest'))
    jest.isolateModules(() => {
      const fresh = require('@/lib/theme/persist') as typeof import('@/lib/theme/persist')
      const store = require('@/lib/theme/store') as typeof import('@/lib/theme/store')
      fresh.readThemeSync()
      expect(store.getTheme()).toMatchObject({ mode: 'dark', accent: 'forest', scheme: 'dark' })
      expect(store.getTheme().palette.brand).toBe('#6ee7a8')
    })
    readThemeSync()
    expect(getTheme()).toMatchObject({ mode: 'dark', accent: 'forest', scheme: 'dark' })
  })
})
