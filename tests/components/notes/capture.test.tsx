import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import { CaptureScreen } from '@/features/notes/capture/CaptureScreen'
import { pickForTray } from '@/features/notes/capture/prepare'
import { uploadToNote } from '@/features/notes/media/NoteMedia'
import { appendCard, createNote, deleteCard } from '@/features/notes/store/actions'
import { createApolloClient } from '@/lib/apollo'
import { mockApi } from '../../support/api'
import { renderInApp as render } from '../../support/render'

/**
 * Notes from photos and PDFs (lvn-backend ADR-0084): the tray fills from the camera, photos and files; Make notes puts
 * them all in one new note and has AI make notes of them; a failed upload is picked up where it stopped.
 */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true } }))
jest.mock('@/features/notes/capture/prepare', () => ({ pickForTray: jest.fn() }))
jest.mock('@/features/notes/store/actions', () => ({ createNote: jest.fn(async () => 'n-new'), setTitle: jest.fn(async () => undefined), appendCard: jest.fn(async () => ({ id: 'c1' })), deleteCard: jest.fn(async () => undefined) }))
jest.mock('@/features/notes/store/db', () => ({ getNote: jest.fn(async () => ({ id: 'n-new', localOnly: false })), getCards: jest.fn(async () => [{ id: 'c-empty', type: 'text', revision: null }]) }))
jest.mock('@/features/notes/sync/engine', () => ({ syncNow: jest.fn(async () => undefined) }))
jest.mock('@/features/notes/media/NoteMedia', () => ({ ...jest.requireActual('@/features/notes/media/NoteMedia'), uploadToNote: jest.fn() }))

const photo = (n: number) => ({ key: `k${n}`, uri: `file:///cache/p${n}.jpg`, name: `p${n}.jpg`, mimeType: 'image/jpeg', size: 420_000, kind: 'image' as const })
const pdf = { key: 'kp', uri: 'file:///cache/handout.pdf', name: 'handout.pdf', mimeType: 'application/pdf', size: 2 * 1024 ** 2, kind: 'pdf' as const }
let runs: unknown[] = []

beforeEach(() => {
  jest.clearAllMocks()
  runs = []
  mockApi({
    RunAiTask: (vars) => {
      runs.push(vars)
      return { data: { runAiTask: { __typename: 'RunAiTaskPayload', artifact: null, userErrors: [] } } }
    },
  })
})
const renderScreen = (start?: 'camera') => render(<ApolloProvider client={createApolloClient()}><CaptureScreen start={start} /></ApolloProvider>)

describe('notes from photos', () => {
  it('fills the tray from photos and files, then makes one note of them all', async () => {
    jest.mocked(pickForTray).mockResolvedValueOnce([photo(1), photo(2)]).mockResolvedValueOnce([pdf])
    jest.mocked(uploadToNote).mockImplementation(async (_c, _n, item) => `f-${item.name}`)
    await renderScreen()
    expect(screen.getByRole('button', { name: 'Make notes' })).toBeDisabled()
    await fireEvent.press(screen.getByRole('button', { name: 'Add from photos' }))
    expect(pickForTray).toHaveBeenLastCalledWith('library', 10)
    await fireEvent.press(await screen.findByRole('button', { name: 'Add from files' }))
    expect(pickForTray).toHaveBeenLastCalledWith('files', 8)
    expect(await screen.findByText('3 of 10')).toBeOnTheScreen()
    expect(screen.getByLabelText('3. handout.pdf, 2.0 MB')).toBeOnTheScreen()

    await fireEvent.press(screen.getByRole('button', { name: 'Remove p2.jpg' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Make notes from 2' }))
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/notes/ai/n-new'))
    expect(uploadToNote).toHaveBeenCalledTimes(2)
    expect(jest.mocked(appendCard).mock.calls).toEqual([
      ['n-new', 'image', { fileId: 'f-p1.jpg', alt: '' }],
      ['n-new', 'file', { fileId: 'f-handout.pdf' }],
    ])
    expect(runs).toEqual([{ input: { noteId: 'n-new', task: 'QUICK_NOTE' } }])
    // The new note's empty first card goes: the note is its photos and PDFs.
    expect(deleteCard).toHaveBeenCalledWith(expect.objectContaining({ id: 'c-empty' }))
  })

  it('opens on the camera from Home, and after a failed upload carries on where it stopped', async () => {
    jest.mocked(pickForTray).mockResolvedValueOnce([photo(1)]).mockResolvedValueOnce([photo(2), photo(3)])
    jest.mocked(uploadToNote).mockResolvedValueOnce('f-1').mockRejectedValueOnce(new Error('network')).mockResolvedValue('f-later')
    await renderScreen('camera')
    await waitFor(() => expect(pickForTray).toHaveBeenCalledWith('camera', 10))
    await fireEvent.press(await screen.findByRole('button', { name: 'Add from photos' }))
    await fireEvent.press(await screen.findByRole('button', { name: 'Make notes from 3' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Check the connection and try again/)
    expect(router.replace).not.toHaveBeenCalled()

    await fireEvent.press(screen.getByRole('button', { name: 'Make notes from 3' }))
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/notes/ai/n-new'))
    // One note; the first photo was not sent again.
    expect(createNote).toHaveBeenCalledTimes(1)
    expect(uploadToNote).toHaveBeenCalledTimes(4)
    expect(jest.mocked(appendCard).mock.calls.map((c) => c[2])).toEqual([{ fileId: 'f-1', alt: '' }, { fileId: 'f-later', alt: '' }, { fileId: 'f-later', alt: '' }])
  })
})
