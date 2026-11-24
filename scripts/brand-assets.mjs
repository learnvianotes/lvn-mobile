#!/usr/bin/env node
/**
 * Renders the LearnViaNotes logo from assets/brand/logo-paths.json into SVG sources (assets/brand/*.svg) and the PNGs
 * Expo uses for the app icon, Android adaptive/monochrome icons, splash and favicon. Needs sharp: run it with
 * NODE_PATH pointing at a sharp install, e.g. lvn-web's (`NODE_PATH=../lvn-web/node_modules/next/node_modules`),
 * or with sharp installed globally.
 *
 *   node scripts/brand-assets.mjs
 */
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const sharp = createRequire(import.meta.url)('sharp')
const root = path.resolve(import.meta.dirname, '..')
const brand = path.join(root, 'assets/brand')
const p = JSON.parse(readFileSync(path.join(brand, 'logo-paths.json'), 'utf8'))
const c = p.colors

const mark = (letter, marker) => p.letters.map((d) => `<path d="${d}" fill="${letter}"/>`).join('') + `<path d="${p.marker}" fill="${marker}"/>`
const tile = (rx) => `<rect width="1024" height="1024" rx="${rx}" fill="${c.tile}"/>`
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">${body}</svg>\n`
// Android adaptive icons show only the central 66 dp of 108 dp, so the mark shrinks into that circle.
const safe = (body) => `<g transform="translate(512 512) scale(0.72) translate(-512 -512)">${body}</g>`

const files = {
  'logo.svg': svg(tile(p.tileRadius) + mark(c.letter, c.marker)), // rounded tile: splash, favicon, docs
  'logo-square.svg': svg(tile(0) + mark(c.letter, c.marker)), // iOS icon: full-bleed, the OS rounds it
  'logo-background.svg': svg(tile(0)), // Android adaptive background layer
  'logo-mark.svg': svg(safe(mark(c.letter, c.marker))), // Android adaptive foreground layer
  'logo-monochrome.svg': svg(safe(mark('#FFFFFF', '#FFFFFF'))), // Android 13 themed icon
}
for (const [name, content] of Object.entries(files)) writeFileSync(path.join(brand, name), content)

const render = (source, target, size) =>
  sharp(Buffer.from(files[source]), { density: Math.max(72, 288 * (size / 1024)) }).resize(size, size).png().toFile(path.join(root, 'assets', target))
await Promise.all([
  render('logo-square.svg', 'icon.png', 1024),
  render('logo-background.svg', 'android-icon-background.png', 1024),
  render('logo-mark.svg', 'android-icon-foreground.png', 1024),
  render('logo-monochrome.svg', 'android-icon-monochrome.png', 1024),
  render('logo.svg', 'splash-icon.png', 1024),
  render('logo.svg', 'favicon.png', 48),
])
console.log('brand assets rendered')
