import type { ApolloClient } from '@apollo/client'
import { uploadToNote } from '@/features/notes/media/NoteMedia'
import { createNote } from '@/features/notes/store/actions'
import { createShareStore, type PendingShare, type ShareStorage } from '@/features/share/pending'
import { saveShareAttempt } from '@/features/share/save'

jest.mock('@/features/notes/store/actions', () => ({
  createNote: jest.fn(async () => 'n-1'),
  setTitle: jest.fn(async () => undefined),
  appendCard: jest.fn(async () => ({ id: 'c-1' })),
  saveCard: jest.fn(async () => undefined),
}))
jest.mock('@/features/notes/store/db', () => ({
  getNote: jest.fn(async () => ({ id: 'n-1', localOnly: false })),
  getCards: jest.fn(async () => []),
}))
jest.mock('@/features/notes/sync/engine', () => ({ syncNow: jest.fn(async () => undefined) }))
jest.mock('@/features/notes/media/NoteMedia', () => ({
  ...jest.requireActual('@/features/notes/media/NoteMedia'),
  uploadToNote: jest.fn(),
}))

function memory(): ShareStorage {
  const raw = new Map<string, string>()
  return {
    getItem: (key) => raw.get(key) ?? null,
    setItem: (key, value) => void raw.set(key, value),
    removeItem: (key) => void raw.delete(key),
  }
}

const share = (): PendingShare => ({
  id: 's1',
  fingerprint: 'fp',
  receivedAt: 1_000,
  text: null,
  items: [
    { key: 'a', uri: 'file:///cache/a.jpg', name: 'a.jpg', mimeType: 'image/jpeg', size: 10, kind: 'image', message: null },
    { key: 'b', uri: 'file:///cache/b.pdf', name: 'b.pdf', mimeType: 'application/pdf', size: 20, kind: 'file', message: null },
  ],
})

describe('saving a share', () => {
  it('creates one note, and a retry after a failed upload uses that same note', async () => {
    const store = createShareStore(memory(), () => 1_000)
    store.save(share())
    const upload = jest.mocked(uploadToNote)
    upload.mockReset()
    jest.mocked(createNote).mockClear()
    upload.mockImplementation(async (_client, noteId, picked) => {
      expect(store.read().share?.noteId).toBe('n-1')
      expect(noteId).toBe('n-1')
      if (picked.name === 'b.pdf' && upload.mock.calls.length === 2) throw new Error('The file could not be uploaded. Try again.')
      return picked.name === 'a.jpg' ? 'f-a' : 'f-b'
    })

    const progress = {
      onNote: (noteId: string) => store.update((current) => ({ ...current, noteId })),
      onTextSaved: () => undefined,
      onUploading: () => undefined,
      onUploaded: (key: string, fileId: string) => store.update((current) => ({
        ...current,
        items: current.items.map((entry) => (entry.key === key ? { ...entry, fileId, message: null } : entry)),
      })),
      onFailed: (key: string, message: string) => store.update((current) => ({
        ...current,
        items: current.items.map((entry) => (entry.key === key ? { ...entry, message } : entry)),
      })),
    }
    const client = {} as ApolloClient
    const input = { mode: 'new' as const, title: 'Shared note', chosen: null }

    const first = await saveShareAttempt(client, store.read().share!, input, progress)
    expect(first).toEqual({ noteId: 'n-1', failed: 1 })
    expect(createNote).toHaveBeenCalledTimes(1)
    expect(store.read().share?.noteId).toBe('n-1')
    expect(store.read().share?.items.find((item) => item.key === 'a')?.fileId).toBe('f-a')

    const second = await saveShareAttempt(client, store.read().share!, input, progress)
    expect(second).toEqual({ noteId: 'n-1', failed: 0 })
    expect(createNote).toHaveBeenCalledTimes(1)
    expect(upload.mock.calls.map((call) => [call[1], call[2].name])).toEqual([
      ['n-1', 'a.jpg'],
      ['n-1', 'b.pdf'],
      ['n-1', 'b.pdf'],
    ])
    expect(store.read().share?.items.every((item) => item.fileId)).toBe(true)
  })
})
