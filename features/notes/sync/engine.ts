import type { ApolloClient } from '@apollo/client'
import { SyncPullDocument, SyncPushDocument, type SyncPullQuery } from '@/graphql/generated/graphql'
import { getSession } from '@/lib/auth/session'
import { newId } from '../model/ids'
import type { LocalNote, SyncOp } from '../model/types'
import * as db from '../store/db'
import { freeze, merge, stale } from './plan'

/**
 * Sync (lvn-backend §13.2): freeze what changed here into the outbox, push the outbox in order, then pull what changed
 * on the server and merge it. One run at a time; runs again if asked while running. Offline, it stops quietly and the
 * next trigger (an edit, coming back online, opening the app) tries again.
 */

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'offline' | 'error'
  lastSyncedAt: string | null
}

let status: SyncStatus = { state: 'idle', lastSyncedAt: null }
const statusListeners = new Set<() => void>()
const setStatus = (next: Partial<SyncStatus>) => {
  status = { ...status, ...next }
  statusListeners.forEach((l) => l())
}
export const getSyncStatus = () => status
export function subscribeSyncStatus(l: () => void): () => void {
  statusListeners.add(l)
  return () => statusListeners.delete(l)
}

let running: Promise<void> | null = null
let again = false
let timer: ReturnType<typeof setTimeout> | undefined

/** The signed-in account, from the access token's subject: local notes belong to one account at a time. */
function accountId(): string | null {
  const token = getSession().accessToken
  if (!token) return null
  try {
    const payload = token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')
    return (JSON.parse(atob(payload)) as { sub?: string }).sub ?? null
  } catch {
    return null
  }
}

export function syncSoon(client: ApolloClient, delayMs = 2_500): void {
  clearTimeout(timer)
  timer = setTimeout(() => void syncNow(client), delayMs)
}

export function syncNow(client: ApolloClient): Promise<void> {
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    do {
      again = false
      await run(client)
    } while (again)
  })().finally(() => {
    running = null
  })
  return running
}

async function run(client: ApolloClient): Promise<void> {
  const account = accountId()
  if (!account) return
  setStatus({ state: 'syncing' })
  try {
    // Another account signed in on this phone: its notes start from nothing.
    if ((await db.getValue('account')) !== account) {
      await db.wipe()
      await db.setValue('account', account)
    }
    for (const note of await db.changedNotes()) {
      const { ops, frozenCardIds } = freeze(note, await db.getCards(note.id, true), newId)
      if (ops.length) await db.enqueue(note.id, ops, frozenCardIds)
    }
    if (!(await push(client))) return setStatus({ state: 'offline' })
    await pull(client)
    setStatus({ state: 'idle', lastSyncedAt: new Date().toISOString() })
  } catch (e) {
    setStatus({ state: isOffline(e) ? 'offline' : 'error' })
  }
}

const isOffline = (e: unknown) => e instanceof TypeError || /network|fetch|timeout|offline/i.test(String((e as Error)?.message ?? e))

/** Pushes the waiting operations; false when it had to stop (offline or the server asked to retry). */
async function push(client: ApolloClient): Promise<boolean> {
  const waiting = await db.outbox('PENDING')
  for (let i = 0; i < waiting.length; i += 100) {
    const batch = waiting.slice(i, i + 100).map((e) => e.op)
    let results
    try {
      const res = await client.mutate({ mutation: SyncPushDocument, variables: { ops: batch } })
      results = res.data?.syncPush.results
    } catch (e) {
      if (isOffline(e)) return false
      throw e
    }
    if (!results) return false
    const byId = new Map(batch.map((op) => [op.clientOpId, op]))
    for (const r of results) {
      const op = byId.get(r.clientOpId) as SyncOp
      if (r.status === 'APPLIED') {
        const revisions = r.cardResults.filter((c) => c.revision !== null && c.status !== 'REJECTED').map((c) => ({ id: c.id, revision: c.revision! }))
        // Cards a note was created with start at revision 1 on the server.
        if (op.kind === 'CREATE_NOTE') revisions.push(...(op.cards ?? []).map((c) => ({ id: c.id, revision: 1 })))
        await db.setRevisions(revisions)
        await db.settle(r.clientOpId, { state: 'DONE' })
      } else if (r.status === 'REJECTED') {
        await db.settle(r.clientOpId, { state: 'ATTENTION', message: r.message ?? 'The server refused this change.' })
      } else {
        await db.settle(r.clientOpId, { state: 'RETRY' })
        return false
      }
    }
  }
  return true
}

async function pull(client: ApolloClient): Promise<void> {
  const waiting = new Set((await db.outbox()).map((e) => e.op.noteId))
  const since = await db.getValue('cursor')
  let after: string | null = null
  for (;;) {
    const res = await client.query({ query: SyncPullDocument, variables: after ? { after } : { since }, fetchPolicy: 'network-only' })
    const page: SyncPullQuery['syncPull'] = res.data!.syncPull
    for (const { note, cards } of page.notes) {
      // A note with changes still on their way keeps the phone's copy until the server has answered them.
      if (waiting.has(note.id)) continue
      const pulledNote = {
        id: note.id,
        title: note.title,
        ownerId: note.owner.id,
        ownerName: note.owner.displayName,
        access: note.viewerAccess,
        visibility: note.visibility,
        publishedAt: note.publishedAt,
        deletedAt: note.deletedAt,
        updatedAt: note.draftUpdatedAt ?? new Date().toISOString(),
      }
      const local = { note: await db.getNote(note.id), cards: await db.getCards(note.id, true) }
      const merged = merge(local, { note: pulledNote, cards: cards.map((c) => ({ id: c.id, type: c.type, position: c.position, revision: c.revision, content: c.content as unknown })) })
      await db.putNote(merged.note)
      await db.putCards(merged.upsert)
      await db.removeCards(merged.remove)
    }
    if (page.hasMore) {
      after = page.cursor
      continue
    }
    const local: LocalNote[] = [...(await db.listNotes(false)), ...(await db.listNotes(true))]
    await db.removeNotes(stale(local, page.liveNoteIds, waiting))
    if (page.cursor) await db.setValue('cursor', page.cursor)
    return
  }
}
