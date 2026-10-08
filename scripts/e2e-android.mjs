#!/usr/bin/env node
/**
 * Runs the Maestro flows in tests/e2e on an Android emulator (spec §17) — no Expo account or cloud.
 *
 *   node scripts/e2e-android.mjs [development|sandbox|production] [--avd <name>] [--apk <path>] [--flow <file>]
 *
 * 1. Uses a running emulator, or boots --avd (default: $LVN_AVD or lvn_pixel_7) headless and waits for it.
 * 2. Installs the newest x86_64 APK for the variant from dist/ (build one with
 *    `pnpm build:android <variant> --abi x86_64`), or --apk.
 * 3. Runs `maestro test tests/e2e` against that emulator with APP_ID set to the variant's application id, API_URL
 *    to the variant's API (the flows make accounts through it) and MAILPIT_URL to the mail sink of lvn-backend's
 *    dev services (default http://localhost:58025) for the codes the API mails.
 *
 * Maestro's adb client stops listing devices if any device is "offline" (for example a phone whose wireless debugging
 * dropped), so the script refuses to start until offline devices are disconnected.
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { variantEnv, VARIANTS } from './variant.mjs'

const APP_IDS = { development: 'com.learnvianotes.dev', sandbox: 'com.learnvianotes.sandbox', production: 'com.learnvianotes' }

const args = process.argv.slice(2)
const opt = (name) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const variant = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--')) ?? 'development'
if (!VARIANTS.includes(variant)) throw new Error(`Unknown variant "${variant}". Use one of: ${VARIANTS.join(', ')}`)

const root = path.resolve(import.meta.dirname, '..')
const sdk = process.env.ANDROID_HOME ?? path.join(os.homedir(), 'Android/Sdk')
const adbBin = existsSync(path.join(sdk, 'platform-tools/adb')) ? path.join(sdk, 'platform-tools/adb') : 'adb'
const maestroBin = [path.join(os.homedir(), '.maestro/bin/maestro')].find(existsSync) ?? 'maestro'

const adb = (...a) => spawnSync(adbBin, a, { encoding: 'utf8' })
const devices = () =>
  adb('devices').stdout.split('\n').slice(1).map((l) => l.trim().split(/\s+/)).filter(([serial]) => serial)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const offline = devices().filter(([, state]) => state !== 'device')
if (offline.length) {
  console.error(`Offline or unauthorised devices break Maestro's device list:\n${offline.map(([s, st]) => `  ${s} (${st})`).join('\n')}`)
  console.error(`Disconnect them first, e.g. \`adb disconnect ${offline[0][0]}\` (or \`adb kill-server\`).`)
  process.exit(1)
}

let emulator = devices().find(([serial]) => serial.startsWith('emulator-'))?.[0]
if (!emulator) {
  const avd = opt('avd') ?? process.env.LVN_AVD ?? 'lvn_pixel_7'
  console.log(`Booting ${avd} headless…`)
  const child = spawn(path.join(sdk, 'emulator/emulator'), ['-avd', avd, '-no-window', '-no-audio', '-no-boot-anim', '-gpu', 'swiftshader_indirect', '-no-snapshot-save'], { detached: true, stdio: 'ignore' })
  child.unref()
  for (let i = 0; i < 120 && !emulator; i++) {
    await sleep(2000)
    const serial = devices().find(([s, st]) => s.startsWith('emulator-') && st === 'device')?.[0]
    if (serial && adb('-s', serial, 'shell', 'getprop', 'sys.boot_completed').stdout.trim() === '1') emulator = serial
  }
  if (!emulator) throw new Error(`${avd} did not boot within 4 minutes`)
}
console.log(`Emulator: ${emulator}`)

let apk = opt('apk')
if (!apk) {
  const dist = path.join(root, 'dist')
  const candidates = existsSync(dist)
    ? readdirSync(dist).filter((f) => f.startsWith(`LearnViaNotes-${variant}-`) && f.endsWith('-x86_64.apk')).map((f) => path.join(dist, f))
    : []
  apk = candidates.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0]
  if (!apk) throw new Error(`No x86_64 APK for ${variant} in dist/. Build one: pnpm build:android ${variant} --abi x86_64`)
}
console.log(`Installing ${path.relative(root, apk)}`)
const install = adb('-s', emulator, 'install', '-r', apk)
if (install.status !== 0) throw new Error(install.stderr || install.stdout)

const flows = opt('flow') ?? 'tests/e2e'
const { EXPO_PUBLIC_API_URL: apiUrl } = variantEnv(variant)
const mailpitUrl = process.env.MAILPIT_URL ?? 'http://localhost:58025'
const vars = [`APP_ID=${APP_IDS[variant]}`, `API_URL=${apiUrl}`, `MAILPIT_URL=${mailpitUrl}`].flatMap((v) => ['-e', v])
const run = spawnSync(maestroBin, ['--device', emulator, 'test', flows, ...vars, '--format', 'junit', '--output', 'dist/e2e/report.xml', '--test-output-dir', 'dist/e2e'], { cwd: root, stdio: 'inherit' })
process.exit(run.status ?? 1)
