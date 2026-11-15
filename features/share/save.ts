import type { ApolloClient } from '@apollo/client'
import { UploadError, cardTypeFor, uploadToNote } from '@/features/notes/media/NoteMedia'
import { appendCard, createNote, saveCard, setTitle } from '@/features/notes/store/actions'
import * as db from '@/features/notes/store/db'
import { syncNow } from '@/features/notes/sync/engine'
import { TYPE_NOT_READY, appendShareToDoc, uploadFailureMessage } from './classify'
import { deleteShareFile, jpegFromHeic } from './files'
import type { PendingItem, PendingShare } from './pending'

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

/**
 * The note a save writes to. A new note keeps the one created on the first attempt. An existing note is the one
 * the person picked.
 */
export function noteTarget(mode: 'new' | 'existing', noteId: string | undefined, chosen: string | null): string | null {
  if (mode === 'existing') return chosen
  return noteId ?? null
}

/** A new note on this phone, titled, then sent so files can be attached to it. `remember` runs as soon as that note exists. */
export async function openShareNote(client: ApolloClient, title: string, existingId: string | null, remember?: (id: string) => void): Promise<string> {
  let id = existingId
  if (!id) {
    id = await createNote({ id: '', name: '' })
    await setTitle(id, title)
    remember?.(id)
  }
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

export type ShareSaveProgress = {
  /** The note exists. Called before sync, so a later failure still has this id. */
  onNote: (noteId: string) => void
  onTextSaved: (noteId: string) => void
  onUploading: (key: string) => void
  onUploaded: (key: string, fileId: string) => void
  onFailed: (key: string, message: string) => void
}

/**
 * Save a share into one note. A retry in new-note mode passes the note from the first attempt and does not create
 * another. Files already uploaded are skipped.
 */
export async function saveShareAttempt(
  client: ApolloClient,
  share: PendingShare,
  input: { mode: 'new' | 'existing'; title: string; chosen: string | null },
  progress: ShareSaveProgress,
): Promise<{ noteId: string; failed: number }> {
  const noteId = await openShareNote(client, input.title, noteTarget(input.mode, share.noteId, input.chosen), progress.onNote)
  if (share.text && !share.textSaved) {
    await appendShareText(noteId, share.text)
    progress.onTextSaved(noteId)
  }
  let failed = 0
  for (const item of share.items) {
    if (item.kind === 'unsupported' || item.fileId) continue
    progress.onUploading(item.key)
    try {
      const fileId = await uploadSharedFile(client, noteId, item)
      progress.onUploaded(item.key, fileId)
    } catch (error) {
      failed += 1
      const message = error instanceof Error ? error.message : 'The file could not be uploaded. Try again.'
      progress.onFailed(item.key, message)
    }
  }
  await syncNow(client)
  return { noteId, failed }
}
