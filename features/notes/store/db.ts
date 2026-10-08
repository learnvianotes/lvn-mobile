import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite'
import type { CardType } from '@/lib/contracts/domain/enums'
import type { LocalCard, LocalNote, OutboxEntry, SyncOp } from '../model/types'

/**
 * The phone's copy of the account's notes (lvn-backend §13.1, §13.2; ADR-0038): SQLite through expo-sqlite, plain SQL
 * and versioned migrations (`PRAGMA user_version`). Every write tells the screens (subscribe) so they read again.
 */

const MIGRATIONS = [
  `CREATE TABLE notes (
     id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, owner_id TEXT NOT NULL, owner_name TEXT NOT NULL, access TEXT NOT NULL,
     visibility TEXT NOT NULL, published_at TEXT, deleted_at TEXT, updated_at TEXT NOT NULL,
     local_only INTEGER NOT NULL DEFAULT 0, title_dirty INTEGER NOT NULL DEFAULT 0, pending_trash TEXT);
   CREATE TABLE cards (
     id TEXT PRIMARY KEY NOT NULL, note_id TEXT NOT NULL, type TEXT NOT NULL, position TEXT NOT NULL, revision INTEGER,
     content TEXT NOT NULL, dirty INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0);
   CREATE INDEX cards_by_note ON cards (note_id, position, id);
   CREATE TABLE outbox (
     seq INTEGER PRIMARY KEY AUTOINCREMENT, client_op_id TEXT NOT NULL UNIQUE, note_id TEXT NOT NULL, op TEXT NOT NULL,
     state TEXT NOT NULL DEFAULT 'PENDING', message TEXT, attempts INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
   CREATE TABLE kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);`,
]

let db: SQLiteDatabase | null = null
const listeners = new Set<() => void>()

function open(): SQLiteDatabase {
  if (db) return db
  db = openDatabaseSync('lvn-notes.db')
  const { user_version: version } = db.getFirstSync<{ user_version: number }>('PRAGMA user_version') ?? { user_version: 0 }
  for (let v = version; v < MIGRATIONS.length; v++) {
    db.withTransactionSync(() => {
      db!.execSync(MIGRATIONS[v]!)
      db!.execSync(`PRAGMA user_version = ${v + 1}`)
    })
  }
  return db
}

/** Screens re-read after any write. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
const changed = () => listeners.forEach((l) => l())

type NoteRow = { id: string; title: string; owner_id: string; owner_name: string; access: string; visibility: string; published_at: string | null; deleted_at: string | null; updated_at: string; local_only: number; title_dirty: number; pending_trash: string | null }
type CardRow = { id: string; note_id: string; type: string; position: string; revision: number | null; content: string; dirty: number; deleted: number }

const toNote = (r: NoteRow): LocalNote => ({
  id: r.id,
  title: r.title,
  ownerId: r.owner_id,
  ownerName: r.owner_name,
  access: r.access as LocalNote['access'],
  visibility: r.visibility as LocalNote['visibility'],
  publishedAt: r.published_at,
  deletedAt: r.deleted_at,
  updatedAt: r.updated_at,
  localOnly: !!r.local_only,
  titleDirty: !!r.title_dirty,
  pendingTrash: r.pending_trash as LocalNote['pendingTrash'],
})
const toCard = (r: CardRow): LocalCard => ({ id: r.id, noteId: r.note_id, type: r.type as CardType, position: r.position, revision: r.revision, content: JSON.parse(r.content) as unknown, dirty: !!r.dirty, deleted: !!r.deleted })

// ── Reading ──────────────────────────────────────────────────────────────────────────────────────────────────

export async function listNotes(trash = false): Promise<LocalNote[]> {
  const rows = await open().getAllAsync<NoteRow>(`SELECT * FROM notes WHERE ${trash ? 'deleted_at IS NOT NULL' : 'deleted_at IS NULL'} ORDER BY updated_at DESC`)
  return rows.map(toNote)
}

export async function getNote(id: string): Promise<LocalNote | null> {
  const row = await open().getFirstAsync<NoteRow>('SELECT * FROM notes WHERE id = ?', id)
  return row ? toNote(row) : null
}

/** A note's cards in order; deleted ones only when asked (sync needs them). */
export async function getCards(noteId: string, withDeleted = false): Promise<LocalCard[]> {
  const rows = await open().getAllAsync<CardRow>(`SELECT * FROM cards WHERE note_id = ? ${withDeleted ? '' : 'AND deleted = 0'} ORDER BY position COLLATE BINARY, id`, noteId)
  return rows.map(toCard)
}

/** Notes with a change not yet frozen into the outbox. */
export async function changedNotes(): Promise<LocalNote[]> {
  const rows = await open().getAllAsync<NoteRow>(
    `SELECT * FROM notes n WHERE n.local_only = 1 OR n.title_dirty = 1 OR n.pending_trash IS NOT NULL
       OR EXISTS (SELECT 1 FROM cards c WHERE c.note_id = n.id AND (c.dirty = 1 OR c.deleted = 1))`,
  )
  return rows.map(toNote)
}

export async function outbox(state?: OutboxEntry['state']): Promise<OutboxEntry[]> {
  const rows = await open().getAllAsync<{ op: string; state: string; message: string | null; attempts: number; created_at: string }>(
    `SELECT op, state, message, attempts, created_at FROM outbox ${state ? 'WHERE state = ?' : ''} ORDER BY seq`,
    ...(state ? [state] : []),
  )
  return rows.map((r) => ({ op: JSON.parse(r.op) as SyncOp, state: r.state as OutboxEntry['state'], message: r.message, attempts: r.attempts, createdAt: r.created_at }))
}

export async function getValue(key: string): Promise<string | null> {
  return (await open().getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key))?.value ?? null
}

/** The first words of each note, for lists (one query). */
export async function excerpts(): Promise<Map<string, string>> {
  const { cardPlainText } = await import('@/lib/contracts/validation')
  const rows = await open().getAllAsync<{ note_id: string; type: string; content: string }>('SELECT note_id, type, content FROM cards WHERE deleted = 0 ORDER BY note_id, position, id')
  const out = new Map<string, string>()
  for (const r of rows) {
    if (out.get(r.note_id)) continue
    const words = cardPlainText(r.type as CardType, JSON.parse(r.content)).replace(/\s+/g, ' ').trim()
    if (words) out.set(r.note_id, words.slice(0, 160))
  }
  return out
}

/** Notes with changes this phone has not sent yet, or the server has not answered. */
export async function unsentNoteIds(): Promise<Set<string>> {
  const rows = await open().getAllAsync<{ id: string }>(
    `SELECT id FROM notes WHERE local_only = 1 OR title_dirty = 1 OR pending_trash IS NOT NULL
     UNION SELECT note_id FROM cards WHERE dirty = 1 OR deleted = 1
     UNION SELECT note_id FROM outbox`,
  )
  return new Set(rows.map((r) => r.id))
}

// ── Writing ──────────────────────────────────────────────────────────────────────────────────────────────────

export async function setValue(key: string, value: string | null): Promise<void> {
  if (value === null) await open().runAsync('DELETE FROM kv WHERE key = ?', key)
  else await open().runAsync('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value', key, value)
}

export async function putNote(n: LocalNote): Promise<void> {
  await open().runAsync(
    `INSERT INTO notes (id, title, owner_id, owner_name, access, visibility, published_at, deleted_at, updated_at, local_only, title_dirty, pending_trash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET title = excluded.title, owner_id = excluded.owner_id, owner_name = excluded.owner_name, access = excluded.access,
       visibility = excluded.visibility, published_at = excluded.published_at, deleted_at = excluded.deleted_at, updated_at = excluded.updated_at,
       local_only = excluded.local_only, title_dirty = excluded.title_dirty, pending_trash = excluded.pending_trash`,
    n.id, n.title, n.ownerId, n.ownerName, n.access, n.visibility, n.publishedAt, n.deletedAt, n.updatedAt, n.localOnly ? 1 : 0, n.titleDirty ? 1 : 0, n.pendingTrash,
  )
  changed()
}

export async function putCards(cards: LocalCard[]): Promise<void> {
  if (!cards.length) return
  const d = open()
  await d.withTransactionAsync(async () => {
    for (const c of cards) {
      await d.runAsync(
        `INSERT INTO cards (id, note_id, type, position, revision, content, dirty, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET note_id = excluded.note_id, type = excluded.type, position = excluded.position, revision = excluded.revision,
           content = excluded.content, dirty = excluded.dirty, deleted = excluded.deleted`,
        c.id, c.noteId, c.type, c.position, c.revision, JSON.stringify(c.content), c.dirty ? 1 : 0, c.deleted ? 1 : 0,
      )
    }
  })
  changed()
}

export async function removeCards(ids: string[]): Promise<void> {
  if (!ids.length) return
  await open().runAsync(`DELETE FROM cards WHERE id IN (${ids.map(() => '?').join(',')})`, ...ids)
  changed()
}

export async function removeNotes(ids: string[]): Promise<void> {
  if (!ids.length) return
  const marks = ids.map(() => '?').join(',')
  const d = open()
  await d.withTransactionAsync(async () => {
    await d.runAsync(`DELETE FROM cards WHERE note_id IN (${marks})`, ...ids)
    await d.runAsync(`DELETE FROM notes WHERE id IN (${marks})`, ...ids)
  })
  changed()
}

/** Freezing: the operations go to the outbox and the changes they carry stop being dirty, in one transaction. */
export async function enqueue(noteId: string, ops: SyncOp[], frozenCardIds: string[]): Promise<void> {
  const d = open()
  const now = new Date().toISOString()
  await d.withTransactionAsync(async () => {
    for (const op of ops) await d.runAsync('INSERT INTO outbox (client_op_id, note_id, op, created_at) VALUES (?, ?, ?, ?)', op.clientOpId, noteId, JSON.stringify(op), now)
    await d.runAsync('UPDATE notes SET local_only = 0, title_dirty = 0, pending_trash = NULL WHERE id = ?', noteId)
    if (frozenCardIds.length) {
      const marks = frozenCardIds.map(() => '?').join(',')
      await d.runAsync(`DELETE FROM cards WHERE deleted = 1 AND id IN (${marks})`, ...frozenCardIds)
      await d.runAsync(`UPDATE cards SET dirty = 0 WHERE id IN (${marks})`, ...frozenCardIds)
    }
  })
  changed()
}

export async function settle(clientOpId: string, outcome: { state: 'DONE' } | { state: 'ATTENTION'; message: string } | { state: 'RETRY' }): Promise<void> {
  const d = open()
  if (outcome.state === 'DONE') await d.runAsync('DELETE FROM outbox WHERE client_op_id = ?', clientOpId)
  else if (outcome.state === 'ATTENTION') await d.runAsync("UPDATE outbox SET state = 'ATTENTION', message = ?, attempts = attempts + 1 WHERE client_op_id = ?", outcome.message, clientOpId)
  else await d.runAsync('UPDATE outbox SET attempts = attempts + 1 WHERE client_op_id = ?', clientOpId)
  changed()
}

/** The server's revision for cards it just stored, unless they changed here again since. */
export async function setRevisions(revisions: { id: string; revision: number }[]): Promise<void> {
  if (!revisions.length) return
  const d = open()
  await d.withTransactionAsync(async () => {
    for (const r of revisions) await d.runAsync('UPDATE cards SET revision = ? WHERE id = ?', r.revision, r.id)
  })
}

/** Removes an operation the server refused, after the person saw it (the note is pulled fresh on the next sync). */
export async function discard(clientOpId: string): Promise<void> {
  await open().runAsync('DELETE FROM outbox WHERE client_op_id = ?', clientOpId)
  changed()
}

/** Everything, for signing out or another account on this phone. */
export async function wipe(): Promise<void> {
  open().execSync('DELETE FROM cards; DELETE FROM notes; DELETE FROM outbox; DELETE FROM kv;')
  changed()
}
