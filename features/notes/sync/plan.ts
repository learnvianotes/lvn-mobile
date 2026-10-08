import { parseCardContent } from '@/lib/contracts/validation'
import type { LocalCard, LocalNote, SyncOp } from '../model/types'

/**
 * The pure half of sync (lvn-backend §13.2), kept apart from storage and the network so it can be tested.
 *
 * freeze: turns what changed on the phone into outbox operations — CREATE_NOTE for a note made here (with its cards),
 * UPDATE_NOTE for title and card changes (each change based on the revision the phone last saw), then trash/restore.
 * Cards whose content is not valid yet stay dirty and wait.
 */
export function freeze(note: LocalNote, cards: LocalCard[], newId: () => string): { ops: SyncOp[]; frozenCardIds: string[] } {
  const ops: SyncOp[] = []
  const frozen: string[] = []
  const valid = (c: LocalCard) => parseCardContent(c.type, c.content).ok
  if (note.localOnly) {
    const live = cards.filter((c) => !c.deleted && valid(c))
    ops.push({ clientOpId: newId(), kind: 'CREATE_NOTE', noteId: note.id, title: note.title, cards: live.map((c) => ({ id: c.id, type: c.type, position: c.position, content: c.content })) })
    frozen.push(...live.map((c) => c.id), ...cards.filter((c) => c.deleted).map((c) => c.id))
  } else {
    const changed = cards.filter((c) => (c.dirty || c.deleted) && (c.deleted || valid(c)))
    if (note.titleDirty || changed.length) {
      ops.push({
        clientOpId: newId(),
        kind: 'UPDATE_NOTE',
        noteId: note.id,
        ...(note.titleDirty ? { title: note.title } : {}),
        ops: changed.flatMap((c): NonNullable<SyncOp['ops']> => {
          const base = c.revision === null ? {} : { baseRevision: c.revision }
          if (c.deleted) return c.revision === null ? [] : [{ kind: 'DELETE', id: c.id, ...base }]
          return [{ kind: 'UPSERT', id: c.id, type: c.type, position: c.position, content: c.content, ...base }]
        }),
      })
      frozen.push(...changed.map((c) => c.id))
    }
  }
  if (note.pendingTrash) ops.push({ clientOpId: newId(), kind: note.pendingTrash === 'TRASH' ? 'TRASH_NOTE' : 'RESTORE_NOTE', noteId: note.id })
  return { ops, frozenCardIds: frozen }
}

export interface PulledNote {
  note: Omit<LocalNote, 'localOnly' | 'titleDirty' | 'pendingTrash'>
  cards: { id: string; type: LocalCard['type']; position: string; revision: number; content: unknown }[]
}

/**
 * merge: what the server says a note is now, applied to the phone's copy. Changes made here and not yet answered win
 * until the server has seen them (it settles conflicts, §13.2): a dirty title or card is kept, a card deleted here
 * stays deleted, everything else follows the server.
 */
export function merge(local: { note: LocalNote | null; cards: LocalCard[] }, pulled: PulledNote): { note: LocalNote; upsert: LocalCard[]; remove: string[] } {
  const keep = new Map(local.cards.filter((c) => c.dirty || c.deleted).map((c) => [c.id, c]))
  const note: LocalNote = {
    ...pulled.note,
    title: local.note?.titleDirty ? local.note.title : pulled.note.title,
    localOnly: false,
    titleDirty: local.note?.titleDirty ?? false,
    pendingTrash: local.note?.pendingTrash ?? null,
  }
  const upsert: LocalCard[] = pulled.cards
    .filter((c) => !keep.has(c.id))
    .map((c) => ({ ...c, noteId: pulled.note.id, dirty: false, deleted: false }))
  const onServer = new Set(pulled.cards.map((c) => c.id))
  const remove = local.cards.filter((c) => !keep.has(c.id) && !onServer.has(c.id)).map((c) => c.id)
  return { note, upsert, remove }
}

/** Notes to drop after a pull: no longer on the account's list, never made here, nothing waiting to be sent. */
export function stale(localNotes: LocalNote[], liveIds: string[], waiting: Set<string>): string[] {
  const live = new Set(liveIds)
  return localNotes.filter((n) => !live.has(n.id) && !n.localOnly && !waiting.has(n.id)).map((n) => n.id)
}
