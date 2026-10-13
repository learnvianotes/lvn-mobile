import { env } from '@/lib/env'
import { newId } from '@/features/notes/model/ids'
import { getValue, queueGrade, removeGrade, setValue, waitingGrades } from '@/features/notes/store/db'
import { authFetch } from './apollo'

/**
 * Flashcard grades from the phone (lvn-backend ADR-0068): each grade goes to the SQLite outbox first, with its own id
 * and the time it was given, then to `reviewCard`; offline they wait and go in order when the network returns. Today's
 * cards are kept on the phone too, so a review session works offline.
 */
export type Rating = 'AGAIN' | 'HARD' | 'GOOD' | 'EASY'
export interface Grade {
  clientOpId: string
  cardId: string
  rating: Rating
  reviewedAt: string
  durationMs: number
}

const REVIEW = `mutation ReviewCard($input: ReviewCardInput!) {
  reviewCard(input: $input) { review { cardId due state intervalDays } userErrors { message code } }
}`
const QUEUE_KEY = 'reviewQueue'

let sending: Promise<void> | null = null

export async function grade(cardId: string, rating: Rating, durationMs: number): Promise<void> {
  await queueGrade({ clientOpId: newId(), cardId, rating, reviewedAt: new Date().toISOString(), durationMs } satisfies Grade)
  void sendGrades()
}

/**
 * Sends waiting grades in the order given, until none wait (grades given while it sends go too); stops at the first
 * that cannot go (offline), keeping the rest.
 */
export function sendGrades(): Promise<void> {
  sending ??= (async () => {
    try {
      for (let grades = await waitingGrades<Grade>(); grades.length; grades = await waitingGrades<Grade>()) {
        for (const g of grades) {
          const res = await authFetch(env.EXPO_PUBLIC_API_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: REVIEW, variables: { input: g } }) })
          const body = (await res.json()) as { data?: { reviewCard?: unknown } }
          // An answer of any kind settles the grade: a refusal (the card left the deck) will not change by trying again.
          if (!body.data?.reviewCard) return
          await removeGrade(g.clientOpId)
        }
      }
    } catch {
      // Offline: the grades wait.
    } finally {
      sending = null
    }
  })()
  return sending
}

export async function waitingCount(): Promise<number> {
  return (await waitingGrades()).length
}

/** Today's cards as last fetched, for a session offline. */
export async function cachedQueue<T>(): Promise<T | null> {
  const raw = await getValue(QUEUE_KEY)
  return raw ? (JSON.parse(raw) as T) : null
}

export async function cacheQueue(queue: unknown): Promise<void> {
  await setValue(QUEUE_KEY, JSON.stringify(queue))
}
