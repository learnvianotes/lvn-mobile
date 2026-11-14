import type { ApolloClient } from '@apollo/client'
import { UploadError, cardTypeFor, uploadToNote } from '@/features/notes/media/NoteMedia'
import { appendCard, createNote, saveCard, setTitle } from '@/features/notes/store/actions'
import * as db from '@/features/notes/store/db'
import { syncNow } from '@/features/notes/sync/engine'
import { TYPE_NOT_READY, appendShareToDoc, uploadFailureMessage } from './classify'
import { deleteShareFile, jpegFromHeic } from './files'
import type { PendingItem } from './pending'

/** The words of a share, added to the note's first text card (or a new one). */
export async function appendShareText(noteId: string, text: string): Promise<void> {
  const cards = await db.getCards(noteId)
  const card = cards.find((item) => item.type === 'text')
  const previous = card && typeof card.content === 'object' && card.content ? (card.content as { doc?: unknown }).doc : null
  const doc = appendShareToDoc(previous, text)
  if (!card) {
    await appendCard(noteId, 'text', { doc })
    return
  }
  const content = typeof card.content === 'object' && card.content ? card.content : {}
  await saveCard(card, { ...content, doc })
}

/** A new note on this phone, titled, then sent so files can be attached to it. */
export async function openShareNote(client: ApolloClient, title: string, existingId: string | null): Promise<string> {
  const id = existingId ?? (await createNote({ id: '', name: '' }))
  if (!existingId) await setTitle(id, title)
  await syncNow(client)
  if ((await db.getNote(id))?.localOnly) throw new UploadError('Connect to the internet to save this share into a note.')
  return id
}

/** One shared file through the note upload, after HEIC has become JPEG. */
export async function uploadSharedFile(client: ApolloClient, noteId: string, item: PendingItem): Promise<string> {
  let uri = item.uri
  let name = item.name
  let mimeType = item.mimeType
  if (item.kind === 'heic') {
    try {
      const jpeg = await jpegFromHeic(uri, name)
      uri = jpeg.uri
      name = jpeg.name
      mimeType = 'image/jpeg'
    } catch {
      throw new UploadError('This picture could not be prepared as a JPEG. Try a JPEG or PNG.')
    }
  }
  const type = cardTypeFor(mimeType)
  if (!type || type === 'video' || type === 'audio') {
    if (uri !== item.uri) deleteShareFile(uri)
    throw new UploadError(TYPE_NOT_READY)
  }
  try {
    const fileId = await uploadToNote(client, noteId, { uri, name, mimeType, size: item.size })
    await appendCard(noteId, type === 'image' ? 'image' : 'file', type === 'image' ? { fileId, alt: '' } : { fileId })
    return fileId
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    throw new UploadError(uploadFailureMessage(message))
  } finally {
    if (uri !== item.uri) deleteShareFile(uri)
  }
}
