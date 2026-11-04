#!/usr/bin/env node
/**
 * Runs the Maestro flows in tests/e2e on an Android emulator (spec §17) — no Expo account or cloud.
 *
 *   node scripts/e2e-android.mjs [development|sandbox|production] [--avd <name>] [--apk <path>] [--flow <file>]
 *                                [--device <serial>] [--vm <lvn-backend/infra/local-vm/vm.sh>]
 *
 * 1. Uses --device, or the running emulator of --avd (default: $LVN_AVD or lvn_pixel_7; other projects may run
 *    emulators of their own), or boots that AVD headless and waits for it.
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

// Other projects may run emulators on this machine too: use --device, else the emulator running our AVD.
const avd = opt('avd') ?? process.env.LVN_AVD ?? 'lvn_pixel_7'
const avdOf = (serial) => adb('-s', serial, 'emu', 'avd', 'name').stdout.split('\n')[0]?.trim()
let emulator = opt('device') ?? devices().find(([serial]) => serial.startsWith('emulator-') && avdOf(serial) === avd)?.[0]
if (!emulator) {
  console.log(`Booting ${avd} headless…`)
  const child = spawn(path.join(sdk, 'emulator/emulator'), ['-avd', avd, '-no-window', '-no-audio', '-no-boot-anim', '-gpu', 'swiftshader_indirect', '-no-snapshot-save'], { detached: true, stdio: 'ignore' })
  child.unref()
  for (let i = 0; i < 120 && !emulator; i++) {
    await sleep(2000)
    const serial = devices().find(([s, st]) => s.startsWith('emulator-') && st === 'device' && avdOf(s) === avd)?.[0]
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
  vars.push(...[`COMMUNITY_EMAIL=${community.email}`, `COMMUNITY_PASSWORD=${community.password}`, `COMMUNITY_GROUP=${community.group}`, `TEACHER_EMAIL=${community.teacherEmail}`, `TEACHER_PASSWORD=${community.teacherPassword}`, `SUSPENDED_EMAIL=${community.suspendedEmail}`, `SUSPENDED_PASSWORD=${community.suspendedPassword}`, `STAMP=${community.stamp}`, `CLASS_NAME=${community.className}`, `QUIZ_TITLE=${community.quizTitle}`, `RESOURCE_TITLE=${community.resourceTitle}`, `NOTE_TITLE=${community.noteTitle}`].flatMap((v) => ['-e', v]))
  console.log(`Community: ${community.email} and the group "${community.group}"`)
}
const run = spawnSync(maestroBin, ['--device', emulator, 'test', flows, ...vars, '--format', 'junit', '--output', 'dist/e2e/report.xml', '--test-output-dir', 'dist/e2e'], { cwd: root, stdio: 'inherit' })
process.exit(run.status ?? 1)

/**
 * A verified learner and a verified teacher for the phone, a public group someone else owns with a post in it, and a
 * class the learner is in with a quiz its teacher published (lvn-backend ADR-0064), on the local environment:
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
    const up = await gql('mutation ($input: SignUpInput!) { signUp(input: $input) { session { accessToken user { id } } userErrors { message } } }', { input: { email, password, displayName, age: 24, acceptedTermsVersion: termsVersion } })
    if (!up.signUp.session) throw new Error(`sign-up failed: ${up.signUp.userErrors[0]?.message}`)
    return { email, password, id: up.signUp.session.user.id, token: up.signUp.session.accessToken }
  }
  const learner = await account('learner', 'Ravi Kumar')
  const owner = await account('owner', 'Meera Iyer')
  const teacher = await account('teacher', 'Anita Desai')
  // Account standing (lvn-backend ADR-0053): a platform admin suspends a third learner, who reads it on the phone.
  const admin = await account('admin', 'Platform Admin')
  const suspended = await account('suspended', 'Kiran Rao')
  const sql = [
    `UPDATE users.\\"User\\" SET \\"verifiedAt\\" = now(), \\"verificationMethod\\" = 'INSTITUTIONAL_EMAIL' WHERE id IN ('${learner.id}', '${owner.id}')`,
    `UPDATE users.\\"User\\" SET \\"verifiedAt\\" = now(), \\"verificationMethod\\" = 'TEACHER', \\"globalRole\\" = 'TEACHER' WHERE id = '${teacher.id}'`,
    `UPDATE users.\\"User\\" SET \\"verifiedAt\\" = now(), \\"verificationMethod\\" = 'INSTITUTIONAL_EMAIL', \\"globalRole\\" = 'PLATFORM_ADMIN' WHERE id = '${admin.id}'`,
  ].join('; ')
  const verified = spawnSync(vmScript, ['ssh', `docker exec lvn-local-postgres psql -U lvn -d lvn -c "${sql}"`], { encoding: 'utf8' })
  if (verified.status !== 0) throw new Error(`verifying the accounts failed: ${verified.stderr}`)
  const group = `Maestro club ${stamp}`
  const made = await gql('mutation ($input: CreateGroupInput!) { createGroup(input: $input) { group { id } userErrors { message } } }', { input: { name: group, privacy: 'PUBLIC', joinPolicy: 'OPEN' } }, owner.token)
  if (!made.createGroup.group) throw new Error(`createGroup failed: ${made.createGroup.userErrors[0]?.message}`)
  const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Welcome to the club' }] }] }
  await gql('mutation ($input: CreateGroupPostInput!) { createGroupPost(input: $input) { post { id } } }', { input: { groupId: made.createGroup.group.id, body } }, owner.token)
  const suspension = await gql('mutation ($input: ModerateContentInput!) { moderateContent(input: $input) { ok userErrors { message } } }', { input: { entityType: 'USER', entityId: suspended.id, action: 'SUSPEND', reason: 'Posting the same link everywhere.', suspendDays: 3 } }, admin.token)
  if (!suspension.moderateContent.ok) throw new Error(`suspending failed: ${suspension.moderateContent.userErrors[0]?.message}`)
  // quiz.yaml: the learner takes a quiz in a class they were let into.
  const className = `Maestro class ${stamp}`
  const klass = (await gql('mutation ($input: CreateClassroomInput!) { createClassroom(input: $input) { classroom { id joinCode } userErrors { message } } }', { input: { name: className } }, teacher.token)).createClassroom.classroom
  if (!klass) throw new Error('createClassroom failed')
  await gql('mutation ($input: RequestToJoinClassroomInput!) { requestToJoinClassroom(input: $input) { classroom { id } } }', { input: { code: klass.joinCode } }, learner.token)
  const asking = (await gql('query ($id: UUID!) { classroom(id: $id) { joinRequests { id } } }', { id: klass.id }, teacher.token)).classroom.joinRequests
  await gql('mutation ($input: ReviewClassroomJoinRequestInput!) { reviewClassroomJoinRequest(input: $input) { classroom { id } } }', { input: { requestId: asking[0].id, decision: 'APPROVED' } }, teacher.token)
  const quizTitle = `Maestro quiz ${stamp}`
  const say = (text) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] })
  const choice = (id, text) => ({ id, content: [{ type: 'text', text }] })
  const questions = [
    { question: say('What makes most of a cell’s ATP?'), choices: [choice('c1', 'Mitochondria'), choice('c2', 'Ribosomes')], correct: ['c1'], multiple: false, explanation: say('Respiration happens in the mitochondria.') },
    { question: say('Where does glycolysis happen?'), choices: [choice('c1', 'Matrix'), choice('c2', 'Cytoplasm')], correct: ['c2'], multiple: false },
  ]
  const quiz = await gql('mutation ($input: PublishClassQuizInput!) { publishClassQuiz(input: $input) { quiz { id } userErrors { message } } }', { input: { classroomId: klass.id, title: quizTitle, questions } }, teacher.token)
  if (!quiz.publishClassQuiz.quiz) throw new Error(`publishClassQuiz failed: ${quiz.publishClassQuiz.userErrors[0]?.message}`)
  // catalogue.yaml (ADR-0075): an approved resource the learner finds and saves.
  const resourceTitle = `Maestro course ${stamp}`
  const topic = (await gql('{ resourceTopicOptions(query: "array") { id } }', {}, owner.token)).resourceTopicOptions[0]
  const sent = await gql('mutation ($input: SubmitResourceInput!) { submitResource(input: $input) { resource { id } userErrors { message } } }', { input: { type: 'COURSE', title: resourceTitle, url: `https://nptel.ac.in/courses/maestro-${stamp}`, topicIds: [topic.id] } }, owner.token)
  if (!sent.submitResource.resource) throw new Error(`submitResource failed: ${sent.submitResource.userErrors[0]?.message}`)
  await gql('mutation ($input: ModerateContentInput!) { moderateContent(input: $input) { ok } }', { input: { entityType: 'RESOURCE', entityId: sent.submitResource.resource.id, action: 'APPROVE' } }, admin.token)
  // A public note by someone else, for saving (ADR-0076): the learner finds it in Explore.
  const noteTitle = `Maestro public note ${stamp}`
  const noteCard = { id: crypto.randomUUID(), type: 'text', position: 'a0', content: { doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Heaps keep the smallest item on top.' }] }] } } }
  const publicNote = (await gql('mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } } }', { input: { title: noteTitle, cards: [noteCard], ...(topic ? { topicIds: [topic.id] } : {}) } }, owner.token)).createNote.note.id
  await gql('mutation ($input: NoteIdInput!) { publishNote(input: $input) { note { id } } }', { input: { noteId: publicNote } }, owner.token)
  await gql('mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { note { id } } }', { input: { noteId: publicNote, visibility: 'PUBLIC' } }, owner.token)
  // The learner follows its topic, so it is in their Community's For You (ADR-0076).
  if (topic) await gql('mutation ($input: UpdateProfileInput!) { updateProfile(input: $input) { userErrors { message } } }', { input: { interestTopicIds: [topic.id] } }, learner.token)
  return { email: learner.email, password: learner.password, group, teacherEmail: teacher.email, teacherPassword: teacher.password, suspendedEmail: suspended.email, suspendedPassword: suspended.password, stamp, className, quizTitle, resourceTitle, noteTitle }
}
