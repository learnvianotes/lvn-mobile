import { positionBetween } from '@/lib/contracts/validation'
import type { CardType } from '@/lib/contracts/domain/enums'
import { newId } from '../model/ids'
import type { LocalCard, LocalNote } from '../model/types'
import * as db from './db'

/**
 * Changes made on the phone (lvn-backend §13.2): written to the local copy at once, marked dirty, and sent by the
 * next sync. Nothing here waits for the network.
 */

const now = () => new Date().toISOString()
const touch = async (noteId: string) => {
  const note = await db.getNote(noteId)
  if (note) await db.putNote({ ...note, updatedAt: now() })
}

/** What an empty card of each type holds (as on the web); types the phone does not edit are not offered. */
export function emptyContent(type: CardType): unknown {
  switch (type) {
    case 'heading':
      return { level: 2, content: [] }
    case 'checklist':
      return { items: [] }
    case 'code':
      return { language: '', code: '' }
    case 'quote':
    case 'text':
      return { doc: { type: 'doc', content: [] } }
    case 'callout':
      return { variant: 'note', doc: { type: 'doc', content: [] } }
    default:
      return { doc: { type: 'doc', content: [] } }
  }
}

export async function createNote(owner: { id: string; name: string }): Promise<string> {
  const id = newId()
  const note: LocalNote = { id, title: '', ownerId: owner.id, ownerName: owner.name, access: 'OWNER', visibility: 'PRIVATE', publishedAt: null, deletedAt: null, updatedAt: now(), localOnly: true, titleDirty: false, pendingTrash: null }
  await db.putNote(note)
  await db.putCards([{ id: newId(), noteId: id, type: 'text', position: positionBetween(null, null), revision: null, content: emptyContent('text'), dirty: true, deleted: false }])
  return id
}

export async function setTitle(noteId: string, title: string): Promise<void> {
  const note = await db.getNote(noteId)
  if (!note) return
  await db.putNote({ ...note, title, titleDirty: !note.localOnly, updatedAt: now() })
}

export async function saveCard(card: LocalCard, content: unknown): Promise<void> {
  await db.putCards([{ ...card, content, dirty: true }])
  await touch(card.noteId)
}

/** A new card after `after` (or at the end); returns it. */
export async function addCard(noteId: string, type: CardType, after: LocalCard | null): Promise<LocalCard> {
  const cards = await db.getCards(noteId)
  const index = after ? cards.findIndex((c) => c.id === after.id) : cards.length - 1
  const prev = index >= 0 ? cards[index]! : null
  const next = cards[index + 1] ?? null
  const card: LocalCard = { id: newId(), noteId, type, position: positionBetween(prev?.position ?? null, next?.position ?? null), revision: null, content: emptyContent(type), dirty: true, deleted: false }
  await db.putCards([card])
  await touch(noteId)
  return card
}

export async function deleteCard(card: LocalCard): Promise<void> {
  // Never sent: nothing to delete on the server.
  if (card.revision === null) await db.removeCards([card.id])
  else await db.putCards([{ ...card, deleted: true, dirty: false }])
  await touch(card.noteId)
}

export async function moveCard(card: LocalCard, direction: -1 | 1): Promise<void> {
  const cards = await db.getCards(card.noteId)
  const i = cards.findIndex((c) => c.id === card.id)
  const j = i + direction
  if (i < 0 || j < 0 || j >= cards.length) return
  // Between the neighbour it passes and the one after that.
  const [a, b] = direction === -1 ? [cards[j - 1] ?? null, cards[j]!] : [cards[j]!, cards[j + 1] ?? null]
  await db.putCards([{ ...card, position: positionBetween(a?.position ?? null, b?.position ?? null), dirty: true }])
  await touch(card.noteId)
}

export async function trashNote(noteId: string, trash: boolean): Promise<void> {
  const note = await db.getNote(noteId)
  if (!note) return
  if (note.localOnly && trash) {
    // Never sent: it simply goes.
    await db.removeNotes([noteId])
    return
  }
  await db.putNote({ ...note, deletedAt: trash ? now() : null, pendingTrash: trash ? 'TRASH' : 'RESTORE', updatedAt: now() })
}
