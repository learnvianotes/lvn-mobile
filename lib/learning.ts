import { addNetworkStateListener } from 'expo-network'
import { AppState } from 'react-native'
import { LEARNING_LIMITS, type LearningEventInput } from '@/lib/contracts/validation/learning'
import type { LearningEventType } from '@/lib/contracts/domain/enums'
import { env } from '@/lib/env'
import { newId } from '@/features/notes/model/ids'
import { queueLearningEvent, removeLearningEvents, waitingLearningEvents } from '@/features/notes/store/db'
import { authFetch } from './apollo'
import { getSession, subscribeSession } from './auth/session'

/**
 * Learning events from the phone (lvn-backend ADR-0067): the one way screens report what a person did. Events wait in
 * the phone's SQLite store (they survive a restart and days offline) and go to `trackEvents` every 10 s, at 20 events,
 * when the app comes back to the foreground or goes to the background, and when the network returns. Only for a
 * signed-in person; the store is wiped at sign-out with everything else.
 */
const TRACK = `mutation TrackEvents($input: TrackEventsInput!) {
  trackEvents(input: $input) { accepted duplicates rejected { index message } userErrors { message code } }
}`
const SESSION = newId()
const PLATFORM = process.env.EXPO_OS === 'ios' ? 'IOS' : 'ANDROID'

type Fields = Partial<Pick<LearningEventInput, 'entityType' | 'entityId' | 'topicKeys' | 'durationMs' | 'metadata'>>

let timer: ReturnType<typeof setTimeout> | null = null
let sending: Promise<void> | null = null
let listening = false

function listen() {
  if (listening) return
  listening = true
  AppState.addEventListener('change', () => void flush())
  addNetworkStateListener((s) => s.isInternetReachable && void flush())
  subscribeSession(() => getSession().status === 'signed-in' && void flush())
}

/** Records one learning event (types and fields: §14.1, ADR-0067). Nothing is recorded signed out. */
export async function track(type: LearningEventType, fields: Fields = {}): Promise<void> {
  if (getSession().status !== 'signed-in') return
  listen()
  const event: LearningEventInput = { id: newId(), type, ...fields, clientTs: new Date().toISOString(), sessionId: SESSION, platform: PLATFORM }
  try {
    const waiting = await queueLearningEvent(event, LEARNING_LIMITS.queued)
    if (waiting >= LEARNING_LIMITS.flushEvery) void flush()
    else timer ??= setTimeout(() => void flush(), LEARNING_LIMITS.flushSeconds * 1000)
  } catch {
    // A learning event never breaks a screen; this one is lost.
  }
}

/** Sends what is waiting, a batch at a time; one sender at a time. Kept for later offline or when refused for now. */
export function flush(): Promise<void> {
  if (timer) clearTimeout(timer)
  timer = null
  sending ??= send().finally(() => (sending = null))
  return sending
}

async function send(): Promise<void> {
  if (getSession().status !== 'signed-in') return
  try {
    for (;;) {
      const batch = await waitingLearningEvents<LearningEventInput>(LEARNING_LIMITS.batch)
      if (!batch.length) return
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const res = await authFetch(env.EXPO_PUBLIC_API_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: TRACK, variables: { input: { events: batch, timeZone } } }) })
      const body = (await res.json()) as { data?: { trackEvents?: { userErrors: unknown[] } } }
      const answer = body.data?.trackEvents
      // Refused for now (too many at once, signed out meanwhile): tried again later. Events refused one by one
      // never will be accepted, so they leave with the sent ones.
      if (!answer || answer.userErrors.length) break
      await removeLearningEvents(batch.map((e) => e.id))
    }
  } catch {
    // Offline or the API is away: kept for the next try.
  }
  if ((await waitingLearningEvents(1)).length) timer ??= setTimeout(() => void flush(), LEARNING_LIMITS.flushSeconds * 1000)
}
