#!/usr/bin/env node
/**
 * Builds a standalone Android release APK locally — no Expo account or EAS (ADR-0008).
 *
 *   node scripts/build-android.mjs [development|sandbox|production] [--abi arm64-v8a]
 *
 * 1. `expo prebuild --clean` regenerates android/ from app.config.ts for the variant (android/ is never edited
 *    by hand and is git-ignored).
 * 2. Gradle `assembleRelease` bundles the JS with the variant's EXPO_PUBLIC_* values and builds the APK.
 * 3. The APK is copied to dist/LearnViaNotes-<variant>-<version>.apk.
 *
 * Signing: Expo's generated project signs release builds with the debug keystore. That APK installs on any
 * phone (sideload / adb) but cannot go to Google Play — store signing is added before the first store release.
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { variantEnv } from './variant.mjs'

const args = process.argv.slice(2)
const variant = args.find((a) => !a.startsWith('--')) ?? 'sandbox'
const abiIndex = args.indexOf('--abi')
const abi = abiIndex >= 0 ? args[abiIndex + 1] : undefined

const root = path.resolve(import.meta.dirname, '..')
const env = variantEnv(variant)

function run(cmd, cmdArgs, cwd = root) {
  console.log(`\n$ ${cmd} ${cmdArgs.join(' ')}`)
  const r = spawnSync(cmd, cmdArgs, { cwd, env, stdio: 'inherit' })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

run('npx', ['expo', 'prebuild', '--platform', 'android', '--clean', '--no-install'])
// --no-daemon: the Gradle daemon would otherwise keep the environment of an earlier build.
const gradleArgs = ['assembleRelease', '--no-daemon']
if (abi) gradleArgs.push(`-PreactNativeArchitectures=${abi}`)
run('./gradlew', gradleArgs, path.join(root, 'android'))

const { version } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
const out = path.join(root, 'dist', `LearnViaNotes-${variant}-${version}${abi ? `-${abi}` : ''}.apk`)
mkdirSync(path.dirname(out), { recursive: true })
copyFileSync(path.join(root, 'android/app/build/outputs/apk/release/app-release.apk'), out)
console.log(`\nAPK: ${path.relative(root, out)}\nInstall on a connected phone: adb install -r "${path.relative(root, out)}"`)
