import { ApolloProvider } from '@apollo/client/react'
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'
import * as ImagePicker from 'expo-image-picker'
import { useAudioPlayer } from 'expo-audio'
import { Alert } from 'react-native'
import { CardEditor } from '@/features/notes/editor/CardEditor'
import { MediaProvider } from '@/features/notes/media/NoteMedia'
import type { LocalCard, LocalNote } from '@/features/notes/model/types'
import { NoteScreen } from '@/features/notes/NoteScreen'
import { CardView } from '@/features/notes/render/CardView'
import * as actions from '@/features/notes/store/actions'
import { createApolloClient } from '@/lib/apollo'
import { mockApi } from '../../support/api'
import { renderInApp } from '../../support/render'

/**
 * Media and structured cards on the phone (lvn-backend P3m): pictures, video, recordings and files from the server's
 * short-lived URLs, uploading a picture into a note, and editing tables, questions, quizzes and flashcards.
 */
const NOTE = '01920000-0000-7000-8000-00000000a001'
const PIC = '01920000-0000-7000-8000-0000000f0001'
const CLIP = '01920000-0000-7000-8000-0000000f0002'
const TAPE = '01920000-0000-7000-8000-0000000f0003'
let mockNote: LocalNote
let mockCards: LocalCard[] = []

jest.mock('@/features/notes/store/db', () => ({
  getNote: jest.fn(async () => mockNote),
  getCards: jest.fn(async () => mockCards),
  unsentNoteIds: jest.fn(async () => new Set()),
  outbox: jest.fn(async () => []),
  subscribe: () => () => {},
}))
jest.mock('@/features/notes/store/actions', () => ({ ...jest.requireActual('@/features/notes/store/actions'), addCard: jest.fn(async () => ({ id: 'new-card' })), saveCard: jest.fn(async () => {}), trashNote: jest.fn() }))
jest.mock('@/features/notes/sync/engine', () => {
  const idle = { state: 'idle', lastSyncedAt: null }
  return { syncSoon: jest.fn(), syncNow: jest.fn(async () => {}), getSyncStatus: () => idle, subscribeSyncStatus: () => () => {} }
})
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true } }))

const local = (over: Partial<LocalNote> = {}): LocalNote => ({ id: NOTE, title: 'Plants', kind: 'NOTE', folderId: null, folderName: null, tags: [], ownerId: 'me', ownerName: 'Asha', access: 'OWNER', visibility: 'PRIVATE', publishedAt: null, deletedAt: null, updatedAt: new Date().toISOString(), localOnly: false, titleDirty: false, pendingTrash: null, ...over })
const card = (id: string, type: LocalCard['type'], content: unknown): LocalCard => ({ id, noteId: NOTE, type, position: `a${id}`, revision: 1, content, dirty: false, deleted: false })
const media = (id: string, mimeType: string, over: Record<string, unknown> = {}) => ({ __typename: 'MediaFile', id, url: `https://storage.test/${id}`, expiresAt: new Date(Date.now() + 600_000).toISOString(), mimeType, fileName: `${id}.bin`, sizeBytes: 1000, width: null, height: null, durationMs: null, thumbUrl: null, mediumUrl: null, largeUrl: null, posterUrl: null, playbackUrl: null, ...over })
const mediaAnswer = (nodes: { id: string; content: unknown; media: unknown }[], endCursor: string | null = null) => ({ data: { note: { __typename: 'Note', id: NOTE, cards: { __typename: 'CardConnection', edges: nodes.map((node) => ({ __typename: 'CardEdge', node: { __typename: 'Card', ...node } })), pageInfo: { __typename: 'PageInfo', hasNextPage: !!endCursor, endCursor } } } } })
const inApollo = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)

beforeEach(() => {
  jest.clearAllMocks()
  mockNote = local()
  mockCards = []
})

it('shows a picture at the size made for phones, plays a video and a recording, and says when it needs a connection', async () => {
  mockApi({
    PhoneNoteMedia: () =>
      mediaAnswer([
        { id: 'c1', content: { fileId: PIC, alt: 'A leaf' }, media: media(PIC, 'image/jpeg', { width: 1200, height: 800, mediumUrl: 'https://storage.test/pic-960.webp' }) },
        { id: 'c2', content: { fileId: CLIP }, media: media(CLIP, 'video/mp4', { playbackUrl: 'https://storage.test/clip-720.mp4' }) },
        { id: 'c3', content: { fileId: TAPE }, media: media(TAPE, 'audio/mpeg', { fileName: 'Lecture.mp3' }) },
      ]),
  })
  await inApollo(
    <MediaProvider noteId={NOTE} cardIds="c1,c2,c3">
      <CardView type="image" content={{ fileId: PIC, alt: 'A leaf', caption: [{ type: 'text', text: 'Fig. 1' }] }} />
      <CardView type="video" content={{ fileId: CLIP }} />
      <CardView type="audio" content={{ fileId: TAPE }} />
      <CardView type="image" content={{ fileId: '01920000-0000-7000-8000-0000000f0009' }} />
    </MediaProvider>,
  )
  expect(await screen.findByTestId('image:https://storage.test/pic-960.webp')).toBeOnTheScreen()
  expect(screen.getByLabelText('A leaf')).toBeOnTheScreen()
  expect(screen.getByText('Fig. 1')).toBeOnTheScreen()
  expect(screen.getByTestId('video-view')).toBeOnTheScreen()
  expect(jest.mocked(useAudioPlayer)).toHaveBeenCalledWith('https://storage.test/' + TAPE)
  await fireEvent.press(screen.getByRole('button', { name: 'Play Lecture.mp3' }))
  expect(jest.mocked(useAudioPlayer).mock.results[0]!.value.play).toHaveBeenCalled()
  expect(screen.getByText('0:00 / 1:35')).toBeOnTheScreen()
  // A file the server has not described (offline, or someone else's private copy).
  expect(screen.getByText('A picture — connect to the internet to see it.')).toBeOnTheScreen()
})

it('a long note’s files come a page at a time, as many as the API gives at once', async () => {
  const api = mockApi({
    PhoneNoteMedia: (v) =>
      v.after === 'page-2'
        ? mediaAnswer([{ id: 'c101', content: { fileId: PIC, alt: 'A leaf' }, media: media(PIC, 'image/jpeg', { mediumUrl: 'https://storage.test/pic-960.webp' }) }])
        : mediaAnswer([{ id: 'c1', content: { fileId: TAPE }, media: media(TAPE, 'audio/mpeg') }], 'page-2'),
  })
  await inApollo(
    <MediaProvider noteId={NOTE} cardIds="c1,c101">
      <CardView type="image" content={{ fileId: PIC, alt: 'A leaf' }} />
    </MediaProvider>,
  )
  expect(await screen.findByTestId('image:https://storage.test/pic-960.webp')).toBeOnTheScreen()
  expect(api.calls.filter((c) => c.op === 'PhoneNoteMedia').map((c) => c.variables.after ?? null)).toEqual(expect.arrayContaining([null, 'page-2']))
})

it('uploads a picture from the photos into the note as a picture card', async () => {
  mockCards = [card('c1', 'text', { doc: { type: 'doc', content: [] } })]
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///photo.jpg', fileName: 'leaf.jpg', mimeType: 'image/jpeg', fileSize: 2048, width: 100, height: 100, type: 'image' }] } as never)
  const api = mockApi({
    PhoneNoteMeta: () => ({ data: { note: null } }),
    PhoneNoteMedia: () => mediaAnswer([]),
    CreateNoteUpload: () => ({ data: { createUploadIntent: { __typename: 'UploadIntentPayload', intent: { __typename: 'UploadIntent', fileId: PIC, uploadUrl: 'https://storage.test/put', uploadHeaders: [{ __typename: 'UploadHeader', name: 'Content-Type', value: 'image/jpeg' }] }, userErrors: [] } } }),
    CompleteNoteUpload: () => ({ data: { completeUpload: { __typename: 'OkPayload', ok: true, userErrors: [] } } }),
  })
  // The picked file and storage's PUT are not the API.
  const puts: { url: string; init?: RequestInit }[] = []
  const graphql = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.startsWith('file://')) return { blob: async () => ({ size: 2048 }) } as unknown as Response
    if (url === 'https://storage.test/put') return (puts.push({ url, init }), { ok: true } as Response)
    return graphql(input, init)
  }) as typeof fetch

  await inApollo(<NoteScreen id={NOTE} />)
  await fireEvent.press(await screen.findByRole('button', { name: 'Add a card' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Picture or video' }))
  await waitFor(() => expect(actions.addCard).toHaveBeenCalledWith(NOTE, 'image', mockCards[0], { fileId: PIC, alt: '' }))
  expect(api.calls.find((c) => c.op === 'CreateNoteUpload')?.variables).toEqual({ input: { fileName: 'leaf.jpg', mimeType: 'image/jpeg', sizeBytes: 2048, purpose: 'ATTACHMENT', parentId: NOTE } })
  expect(puts[0]?.init).toMatchObject({ method: 'PUT', headers: { 'Content-Type': 'image/jpeg' } })
  expect(api.calls.find((c) => c.op === 'CompleteNoteUpload')?.variables).toEqual({ fileId: PIC })
})

it('a note not sent yet takes pictures once it reaches the server', async () => {
  mockNote = local({ localOnly: true })
  // (A heading: a new note's empty text card opens in the rich-text editor, a web view tests do not run.)
  mockCards = [card('c1', 'heading', { level: 2, content: [{ type: 'text', text: 'Leaves' }] })]
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  mockApi({ PhoneNoteMedia: () => ({ data: { note: null } }) })
  await inApollo(<NoteScreen id={NOTE} />)
  await fireEvent.press(await screen.findByRole('button', { name: 'Add a card' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Photo' }))
  expect(alert).toHaveBeenCalledWith('Not sent yet', expect.stringContaining('Once it has been sent'))
  expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled()
})

it('edits a table: cells, a row, a column and the header row', async () => {
  const onChange = jest.fn()
  const table = card('t1', 'table', { hasHeaderRow: true, rows: [[[], []], [[], []]] })
  await renderInApp(<CardEditor card={table} onChange={onChange} />)
  await fireEvent.changeText(screen.getByLabelText('Row 1, column 1'), 'Plant')
  expect(onChange).toHaveBeenLastCalledWith({ hasHeaderRow: true, rows: [[[{ type: 'text', text: 'Plant' }], []], [[], []]] })
  await fireEvent.press(screen.getByRole('button', { name: 'Add a row' }))
  expect(onChange.mock.lastCall[0].rows).toHaveLength(3)
  await fireEvent.press(screen.getByRole('button', { name: 'Add a column' }))
  expect(onChange.mock.lastCall[0].rows[0]).toHaveLength(3)
  await fireEvent(screen.getByLabelText('Header row'), 'valueChange', false)
  expect(onChange.mock.lastCall[0].hasHeaderRow).toBe(false)
  // Never fewer than one row or column.
  expect(screen.getByRole('button', { name: 'Remove a row' })).not.toBeDisabled()
})

it('edits a quiz: its question, choices, the right answer and several right answers', async () => {
  const onChange = jest.fn()
  const quiz = card('q1', 'quiz', actions.emptyContent('quiz'))
  const [a, b] = (quiz.content as { choices: { id: string }[] }).choices
  await renderInApp(<CardEditor card={quiz} onChange={onChange} />)
  await fireEvent.changeText(screen.getByLabelText('Question'), 'Which make food?')
  expect(onChange.mock.lastCall[0].question).toEqual({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Which make food?' }] }] })
  await fireEvent.changeText(screen.getByLabelText('Choice 2'), 'Leaves')
  expect(onChange.mock.lastCall[0].choices[1]).toEqual({ id: b!.id, content: [{ type: 'text', text: 'Leaves' }] })
  await fireEvent.press(screen.getByRole('radio', { name: 'Choice 2 is right' }))
  expect(onChange.mock.lastCall[0].correct).toEqual([b!.id])
  // Two choices is the least a quiz has.
  expect(screen.getByRole('button', { name: 'Remove choice 1' })).toBeDisabled()
  await fireEvent.press(screen.getByRole('button', { name: 'Add a choice' }))
  expect(onChange.mock.lastCall[0].choices).toHaveLength(3)
  await fireEvent(screen.getByLabelText('More than one right answer'), 'valueChange', true)
  expect(onChange.mock.lastCall[0]).toMatchObject({ multiple: true, correct: [a!.id] })
})

it('edits a question with an optional hint, and a flashcard', async () => {
  const onQuestion = jest.fn()
  await renderInApp(<CardEditor card={card('x', 'question', actions.emptyContent('question'))} onChange={onQuestion} />)
  await fireEvent.changeText(screen.getByLabelText('Answer'), 'Chlorophyll')
  expect(onQuestion.mock.lastCall[0].answer.content[0].content[0].text).toBe('Chlorophyll')
  await fireEvent.changeText(screen.getByLabelText('Hint (optional)'), '')
  expect(onQuestion.mock.lastCall[0].hint).toBeUndefined()

  const onCard = jest.fn()
  await renderInApp(<CardEditor card={card('f', 'flashcard', actions.emptyContent('flashcard'))} onChange={onCard} />)
  await fireEvent.changeText(screen.getByLabelText('Back'), 'Photosynthesis')
  await act(async () => undefined)
  expect(onCard.mock.lastCall[0].back.content[0].content[0].text).toBe('Photosynthesis')
})
