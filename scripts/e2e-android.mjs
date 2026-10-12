#!/usr/bin/env node
/**
 * Runs the Maestro flows in tests/e2e on an Android emulator (spec §17) — no Expo account or cloud.
 *
 *   node scripts/e2e-android.mjs [development|sandbox|production] [--avd <name>] [--apk <path>] [--flow <file>]
 *                                [--vm <lvn-backend/infra/local-vm/vm.sh>]
 *
 * 1. Uses a running emulator, or boots --avd (default: $LVN_AVD or lvn_pixel_7) headless and waits for it.
 * 2. Installs the newest x86_64 APK for the variant from dist/ (build one with
 *    `pnpm build:android <variant> --abi x86_64`), or --apk.
 * 3. Runs `maestro test tests/e2e` against that emulator with APP_ID set to the variant's application id, API_URL
 *    to the variant's API (the flows make accounts through it) and MAILPIT_URL to the mail sink of lvn-backend's
 *    dev services (default http://localhost:58025) for the codes the API mails.
 *
 * With --vm (the local environment, lvn-backend ADR-0036), community.yaml runs too: joining and posting need a verified
 * account, which only the database gives, so the script makes a verified learner and a public group with a post
 * through the API and the VM's database, and hands them to Maestro as COMMUNITY_EMAIL, COMMUNITY_PASSWORD and
 * COMMUNITY_GROUP.
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
const vm = opt('vm') ?? process.env.LVN_VM
if (vm) {
  const community = await seedCommunity(apiUrl, vm)
  vars.push(...[`COMMUNITY_EMAIL=${community.email}`, `COMMUNITY_PASSWORD=${community.password}`, `COMMUNITY_GROUP=${community.group}`, `TEACHER_EMAIL=${community.teacherEmail}`, `TEACHER_PASSWORD=${community.teacherPassword}`, `STAMP=${community.stamp}`].flatMap((v) => ['-e', v]))
  console.log(`Community: ${community.email} and the group "${community.group}"`)
}
const run = spawnSync(maestroBin, ['--device', emulator, 'test', flows, ...vars, '--format', 'junit', '--output', 'dist/e2e/report.xml', '--test-output-dir', 'dist/e2e'], { cwd: root, stdio: 'inherit' })
process.exit(run.status ?? 1)

/**
 * A verified learner and a verified teacher for the phone, and a public group someone else owns with a post in it, on
 * the local environment:
 * accounts through the API, verification through the VM's database (as lvn-backend's lifecycle check does).
 */
async function seedCommunity(api, vmScript) {
  const gql = async (query, variables = {}, token) => {
    const res = await fetch(api, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ query, variables }) })
    const body = await res.json()
    if (body.errors?.length) throw new Error(body.errors[0].message)
    return body.data
  }
  const stamp = Date.now()
  const { termsVersion } = await gql('{ termsVersion }')
  const account = async (who, displayName) => {
    const email = `e2e-${who}-${stamp}@example.com`
    const password = `lvn e2e passphrase ${stamp}`
    const up = await gql('mutation ($input: SignUpInput!) { signUp(input: $input) { session { accessToken user { id } } userErrors { message } } }', { input: { email, password, displayName, dateOfBirth: '2002-04-10', acceptedTermsVersion: termsVersion } })
    if (!up.signUp.session) throw new Error(`sign-up failed: ${up.signUp.userErrors[0]?.message}`)
    return { email, password, id: up.signUp.session.user.id, token: up.signUp.session.accessToken }
  }
  const learner = await account('learner', 'Ravi Kumar')
  const owner = await account('owner', 'Meera Iyer')
  const teacher = await account('teacher', 'Anita Desai')
  const sql = [
    `UPDATE users.\\"User\\" SET \\"verifiedAt\\" = now(), \\"verificationMethod\\" = 'INSTITUTIONAL_EMAIL' WHERE id IN ('${learner.id}', '${owner.id}')`,
    `UPDATE users.\\"User\\" SET \\"verifiedAt\\" = now(), \\"verificationMethod\\" = 'TEACHER', \\"globalRole\\" = 'TEACHER' WHERE id = '${teacher.id}'`,
  ].join('; ')
  const verified = spawnSync(vmScript, ['ssh', `docker exec lvn-local-postgres psql -U lvn -d lvn -c "${sql}"`], { encoding: 'utf8' })
  if (verified.status !== 0) throw new Error(`verifying the accounts failed: ${verified.stderr}`)
  const group = `Maestro club ${stamp}`
  const made = await gql('mutation ($input: CreateGroupInput!) { createGroup(input: $input) { group { id } userErrors { message } } }', { input: { name: group, privacy: 'PUBLIC', joinPolicy: 'OPEN' } }, owner.token)
  if (!made.createGroup.group) throw new Error(`createGroup failed: ${made.createGroup.userErrors[0]?.message}`)
  const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Welcome to the club' }] }] }
  await gql('mutation ($input: CreateGroupPostInput!) { createGroupPost(input: $input) { post { id } } }', { input: { groupId: made.createGroup.group.id, body } }, owner.token)
  return { email: learner.email, password: learner.password, group, teacherEmail: teacher.email, teacherPassword: teacher.password, stamp }
}
