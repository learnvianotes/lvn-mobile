import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import { Alert } from 'react-native'
import { HomeHeader } from '@/features/home/HomeHeader'
import { QuickActions } from '@/features/home/QuickActions'
import { pickMedia } from '@/features/notes/media/pickMedia'
import { uploadToNote } from '@/features/notes/media/NoteMedia'
import { addCard, createNote, setTitle } from '@/features/notes/store/actions'
import { CreateSheet } from '@/features/shell/CreateSheet'
import { titleFromFileName } from '@/features/shell/create'
import { createApolloClient } from '@/lib/apollo'
import { mockApi, viewer } from '../../support/api'
import { renderInApp as render } from '../../support/render'

/**
 * No dead controls (lvn-backend ADR-0076): every tile on Home and every option of the create sheet does what it says —
 * the search bar opens Explore, the avatar the Profile tab, Q&A Ask Nova, Camera the tray of photos for notes, Voice a recording, Upload
 * a file in a new note (a PDF in the reader), and Quiz and Flashcards a note that starts with that card.
 */
jest.mock('@/lib/haptics', () => ({ haptic: { tick: jest.fn(), press: jest.fn(), success: jest.fn() } }))
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))
jest.mock('@/features/notifications/live', () => ({ useLive: jest.fn() }))
jest.mock('@/features/notes/store/actions', () => ({ createNote: jest.fn(async () => 'n-new'), setTitle: jest.fn(async () => undefined), addCard: jest.fn(async () => ({ id: 'c1' })) }))
jest.mock('@/features/notes/store/db', () => ({ getNote: jest.fn(async () => ({ id: 'n-new', localOnly: false })) }))
jest.mock('@/features/notes/sync/engine', () => ({ syncNow: jest.fn(async () => undefined) }))
jest.mock('@/features/notes/media/pickMedia', () => ({ pickMedia: jest.fn() }))
jest.mock('@/features/notes/media/NoteMedia', () => ({ ...jest.requireActual('@/features/notes/media/NoteMedia'), uploadToNote: jest.fn(async () => 'f-1') }))

const picked = (name: string, mimeType: string) => ({ uri: `file:///cache/${name}`, name, mimeType, size: 1000 })

beforeEach(() => {
  jest.clearAllMocks()
  mockApi({
    Viewer: () => ({ data: { viewer: viewer({ displayName: 'Ravi Kumar' }) } }),
    UnreadNotificationCount: () => ({ data: { unreadNotificationCount: 0 } }),
    RunAiTask: () => ({ data: { runAiTask: { __typename: 'RunAiTaskPayload', job: null, userErrors: [] } } }),
  })
})
const renderInApp = (ui: React.ReactElement) => render(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)

describe('Home', () => {
  it('the search bar opens Explore ready to type, and the avatar shows the person and opens the Profile tab', async () => {
    await renderInApp(<HomeHeader />)
    await fireEvent.press(screen.getByRole('search', { name: 'Search or ask Nova' }))
    expect(router.push).toHaveBeenCalledWith({ pathname: '/explore', params: { focus: expect.any(String) } })
    const avatar = screen.getByRole('button', { name: 'Your account' })
    expect(await screen.findByText('R')).toBeOnTheScreen()
    await fireEvent.press(avatar)
    expect(router.push).toHaveBeenCalledWith('/profile')
  })

  it('every quick tile acts: Notes, Q&A, Camera, Voice and Upload', async () => {
    jest.mocked(pickMedia).mockResolvedValue(null)
    await renderInApp(<QuickActions />)
    await fireEvent.press(screen.getByRole('button', { name: 'Notes' }))
    expect(router.push).toHaveBeenLastCalledWith('/notes')
    await fireEvent.press(screen.getByRole('button', { name: 'Q&A' }))
    expect(router.push).toHaveBeenLastCalledWith('/ask')
    await fireEvent.press(screen.getByRole('button', { name: 'Camera' }))
    await waitFor(() => expect(router.push).toHaveBeenLastCalledWith('/notes/capture?start=camera'))
    await fireEvent.press(screen.getByRole('button', { name: 'Voice' }))
    await waitFor(() => expect(router.push).toHaveBeenLastCalledWith('/notes/record/n-new?transcribe=1'))
    expect(setTitle).toHaveBeenCalledWith('n-new', expect.stringMatching(/^Voice note, /))
    await fireEvent.press(screen.getByRole('button', { name: 'Upload' }))
    await waitFor(() => expect(pickMedia).toHaveBeenCalledWith('files'))
  })
})

describe('the create sheet', () => {
  it('Quiz and Flashcards start a note with that card, and open it', async () => {
    await renderInApp(<CreateSheet open onClose={jest.fn()} />)
    await fireEvent.press(screen.getByRole('button', { name: 'Quiz' }))
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/notes/n-new'))
    expect(createNote).toHaveBeenCalledWith({ id: '', name: '' }, 'NOTE', 'quiz')
    expect(setTitle).toHaveBeenCalledWith('n-new', expect.stringMatching(/^Quiz, /))

    await renderInApp(<CreateSheet open onClose={jest.fn()} />)
    await fireEvent.press(screen.getByRole('button', { name: 'Flashcards' }))
    await waitFor(() => expect(createNote).toHaveBeenLastCalledWith({ id: '', name: '' }, 'NOTE', 'flashcard'))
  })

  it('Upload puts a PDF in a new note named after it and opens the reader; a picture opens the note', async () => {
    jest.mocked(pickMedia).mockResolvedValueOnce(picked('Operating_Systems_ch3.pdf', 'application/pdf'))
    await renderInApp(<CreateSheet open onClose={jest.fn()} />)
    await fireEvent.press(screen.getByRole('button', { name: 'Upload' }))
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/notes/read/n-new/f-1'))
    expect(setTitle).toHaveBeenCalledWith('n-new', 'Operating Systems ch3')
    expect(uploadToNote).toHaveBeenCalledWith(expect.anything(), 'n-new', expect.objectContaining({ mimeType: 'application/pdf' }))
    expect(addCard).toHaveBeenCalledWith('n-new', 'file', null, { fileId: 'f-1' })

    jest.mocked(pickMedia).mockResolvedValueOnce(picked('board.jpg', 'image/jpeg'))
    await renderInApp(<CreateSheet open onClose={jest.fn()} />)
    await fireEvent.press(screen.getByRole('button', { name: 'Upload' }))
    await waitFor(() => expect(addCard).toHaveBeenLastCalledWith('n-new', 'image', null, { fileId: 'f-1', alt: '' }))
    expect(router.push).toHaveBeenLastCalledWith('/notes/n-new')
  })

  it('Upload says so when a file is not for notes, and when the upload fails', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
    jest.mocked(pickMedia).mockResolvedValueOnce(picked('archive.zip', 'application/zip'))
    await renderInApp(<CreateSheet open onClose={jest.fn()} />)
    await fireEvent.press(screen.getByRole('button', { name: 'Upload' }))
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Not for notes', 'Notes take pictures, videos, recordings, PDFs and documents.'))
    expect(createNote).not.toHaveBeenCalled()

    jest.mocked(pickMedia).mockResolvedValueOnce(picked('notes.pdf', 'application/pdf'))
    jest.mocked(uploadToNote).mockRejectedValueOnce(new Error('network'))
    await renderInApp(<CreateSheet open onClose={jest.fn()} />)
    await fireEvent.press(screen.getByRole('button', { name: 'Upload' }))
    await waitFor(() => expect(alert).toHaveBeenLastCalledWith('Not uploaded', 'The file could not be uploaded. Check the connection and try again.'))
    expect(router.push).toHaveBeenLastCalledWith('/notes/n-new')
  })

  it('names a note after its file', () => {
    expect(titleFromFileName('Graph_theory__notes.pdf')).toBe('Graph theory notes')
    expect(titleFromFileName('lecture 3.final.mp4')).toBe('lecture 3.final')
  })
})
