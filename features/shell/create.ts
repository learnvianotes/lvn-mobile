import { useApolloClient, useMutation } from '@apollo/client/react'
import { router } from 'expo-router'
import { Alert } from 'react-native'
import { cardTypeFor, UploadError, uploadToNote } from '@/features/notes/media/NoteMedia'
import { pickMedia } from '@/features/notes/media/pickMedia'
import { addCard, createNote, setTitle } from '@/features/notes/store/actions'
import * as db from '@/features/notes/store/db'
import { syncNow } from '@/features/notes/sync/engine'
import { readerPath } from '@/features/reader/paths'
import { RunAiTaskDocument } from '@/graphql/generated/graphql'

/** What the create sheet and Home's tiles make (spec §13.1; lvn-backend ADR-0014, ADR-0052, ADR-0076). */
export type CreateAction = 'Note' | 'Quick note' | 'Voice note' | 'Photo' | 'Upload' | 'Quiz' | 'Flashcards' | 'Project' | 'Blog post' | 'Post'

const KIND: Partial<Record<CreateAction, 'PROJECT' | 'BLOG' | 'POST'>> = { Project: 'PROJECT', 'Blog post': 'BLOG', Post: 'POST' }

/** A note's title from a file's name: no extension, spaces for underscores (as the web's "Read a PDF"). */
export function titleFromFileName(name: string): string {
  return name.replace(/\.[a-z0-9]{1,5}$/i, '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)
}

/**
 * The create actions, one place for the sheet and Home:
 * - a note, quick note, project, blog post or post is written on the phone (it syncs later);
 * - a quiz or flashcards is a note that starts with that card;
 * - a voice note and a photo go to the server at once, transcribed or tidied into notes by AI (lvn-backend ADR-0062,
 *   ADR-0066);
 * - an upload puts a PDF, picture, video or recording in a new note; a PDF opens in the reader (ADR-0040).
 */
export function useCreate() {
  const client = useApolloClient()
  const [runTask] = useMutation(RunAiTaskDocument)
  const stamp = () => new Date().toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
  /** A new note of the person's, on the server (recordings, photos and files upload to it). */
  const newNote = async (title: string) => {
    const id = await createNote({ id: '', name: '' })
    await setTitle(id, title)
    await syncNow(client)
    return id
  }
  return async (action: CreateAction) => {
    const kind = KIND[action]
    if (action === 'Note' || action === 'Quick note' || kind) {
      const id = await createNote({ id: '', name: '' }, kind)
      router.push(`/notes/${id}`)
    } else if (action === 'Quiz' || action === 'Flashcards') {
      const id = await createNote({ id: '', name: '' }, 'NOTE', action === 'Quiz' ? 'quiz' : 'flashcard')
      await setTitle(id, `${action}, ${stamp()}`)
      router.push(`/notes/${id}`)
    } else if (action === 'Voice note') {
      const id = await newNote(`Voice note, ${stamp()}`)
      router.push(`/notes/record/${id}?transcribe=1`)
    } else if (action === 'Photo') {
      const picked = await pickMedia('camera')
      if (picked === 'denied') return Alert.alert('No camera', 'Allow LearnViaNotes to use the camera in the phone’s settings to take photos for notes.')
      if (!picked) return
      const id = await newNote(`Quick note, ${stamp()}`)
      router.push(`/notes/${id}`)
      try {
        if ((await db.getNote(id))?.localOnly) throw new UploadError('Connect to the internet to make notes from a photo.')
        const fileId = await uploadToNote(client, id, picked)
        await addCard(id, 'image', null, { fileId, alt: '' })
        await syncNow(client)
        await runTask({ variables: { input: { noteId: id, task: 'QUICK_NOTE' } } })
        router.push(`/notes/ai/${id}`)
      } catch (e) {
        Alert.alert('Not made', e instanceof UploadError ? e.message : 'The photo could not be turned into notes. It is in the note; try Tidy into notes from AI tasks.')
      }
    } else if (action === 'Upload') {
      const picked = await pickMedia('files')
      if (!picked || picked === 'denied') return
      const type = cardTypeFor(picked.mimeType)
      if (!type) return Alert.alert('Not for notes', 'Notes take pictures, videos, recordings and PDFs.')
      const id = await newNote(titleFromFileName(picked.name) || `Upload, ${stamp()}`)
      try {
        if ((await db.getNote(id))?.localOnly) throw new UploadError('Connect to the internet to upload a file into a note.')
        const fileId = await uploadToNote(client, id, picked)
        await addCard(id, type, null, type === 'image' ? { fileId, alt: '' } : { fileId })
        await syncNow(client)
        router.push(type === 'file' ? readerPath(id, fileId) : `/notes/${id}`)
      } catch (e) {
        router.push(`/notes/${id}`)
        Alert.alert('Not uploaded', e instanceof UploadError ? e.message : 'The file could not be uploaded. Check the connection and try again.')
      }
    }
  }
}
