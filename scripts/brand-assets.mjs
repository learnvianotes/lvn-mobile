#!/usr/bin/env node
/**
 * Renders the LearnViaNotes logo from assets/brand/logo-paths.json into SVG sources (assets/brand/*.svg) and the PNGs
 * Expo uses for the app icon, Android adaptive/monochrome icons, splash and favicon. Needs `rsvg-convert` (librsvg).
 *
 *   node scripts/brand-assets.mjs
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const brand = path.join(root, 'assets/brand')
const p = JSON.parse(readFileSync(path.join(brand, 'logo-paths.json'), 'utf8'))
const c = p.colors

const defs = `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${c.gradient[0]}"/><stop offset="0.55" stop-color="${c.gradient[1]}"/><stop offset="1" stop-color="${c.gradient[2]}"/>
  </linearGradient>
  <radialGradient id="glow" cx="0.22" cy="0.18" r="0.75">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.22"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
  </radialGradient>`
const strokes = (color) =>
  p.lines.map((d) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="18" stroke-linecap="round"/>`).join('') +
  `<path d="${p.check}" fill="none" stroke="${color === '#000' ? '#000' : c.check}" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>`
const mark = `<path d="${p.leftPage}" fill="${c.page}"/><path d="${p.rightPage}" fill="${c.pageShade}"/>${strokes(c.line)}<path d="${p.spark}" fill="${c.spark}"/>`
const background = (rx) => `<rect width="1024" height="1024" rx="${rx}" fill="url(#bg)"/><rect width="1024" height="1024" rx="${rx}" fill="url(#glow)"/>`
const svg = (body, extraDefs = defs) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024"><defs>${extraDefs}</defs>${body}</svg>\n`
const monoMask = `<mask id="cut" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><rect width="1024" height="1024" fill="#000"/><path d="${p.leftPage}" fill="#fff"/><path d="${p.rightPage}" fill="#fff"/>${strokes('#000')}</mask>`

const files = {
  'logo.svg': svg(background(p.tileRadius) + mark), // rounded tile: splash, favicon, docs
  'logo-square.svg': svg(background(0) + mark), // iOS icon: full-bleed, the OS rounds it
  'logo-background.svg': svg(background(0)), // Android adaptive background layer
  'logo-mark.svg': svg(mark, ''), // Android adaptive foreground layer
  'logo-monochrome.svg': svg(`<rect width="1024" height="1024" fill="#FFFFFF" mask="url(#cut)"/><path d="${p.spark}" fill="#FFFFFF"/>`, monoMask),
}
for (const [name, content] of Object.entries(files)) writeFileSync(path.join(brand, name), content)

const render = (source, target, size) =>
  execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), path.join(brand, source), '-o', path.join(root, 'assets', target)])
render('logo-square.svg', 'icon.png', 1024)
render('logo-background.svg', 'android-icon-background.png', 1024)
render('logo-mark.svg', 'android-icon-foreground.png', 1024)
render('logo-monochrome.svg', 'android-icon-monochrome.png', 1024)
render('logo.svg', 'splash-icon.png', 1024)
render('logo.svg', 'favicon.png', 48)
console.log('brand assets rendered')
