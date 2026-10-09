#!/usr/bin/env node
/**
 * The PDF reader's copy of pdf.js's viewer styles (features/reader/pdf-viewer.css), made from
 * node_modules/pdfjs-dist/legacy/web/pdf_viewer.css. Expo's CSS step (lightningcss) refuses relative url()s inside
 * custom properties, and the images they name are for pdf.js's editing toolbars, which the reader does not use: they
 * become `none`. Data URLs stay. The copy is committed; run this after upgrading pdfjs-dist.
 *
 *   node scripts/pdfjs-css.mjs           write the copy
 *   node scripts/pdfjs-css.mjs --check   fail if the copy is out of date (CI)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const pkg = JSON.parse(readFileSync(path.join(root, 'node_modules/pdfjs-dist/package.json'), 'utf8'))
const source = readFileSync(path.join(root, 'node_modules/pdfjs-dist/legacy/web/pdf_viewer.css'), 'utf8')
const target = path.join(root, 'features/reader/pdf-viewer.css')
const css = source.replace(/url\((["']?)(?!data:)[^)"']+\1\)/g, 'none')
const wanted = `/* pdf.js ${pkg.version} viewer styles, made by scripts/pdfjs-css.mjs — do not edit here. */\n${css}`

if (process.argv.includes('--check')) {
  if (!existsSync(target) || readFileSync(target, 'utf8') !== wanted) {
    console.error('features/reader/pdf-viewer.css is out of date; run node scripts/pdfjs-css.mjs')
    process.exit(1)
  }
} else {
  writeFileSync(target, wanted)
  console.log(`features/reader/pdf-viewer.css ← pdfjs-dist ${pkg.version}`)
}
