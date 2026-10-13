import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { requestRecordingPermissionsAsync, useAudioRecorder } from 'expo-audio'
import { router } from 'expo-router'
import { AiScreen } from '@/features/ai/AiScreen'
import { RecordScreen } from '@/features/notes/media/RecordScreen'
import * as actions from '@/features/notes/store/actions'
import { syncNow } from '@/features/notes/sync/engine'
import { createApolloClient } from '@/lib/apollo'
import { mockApi } from '../../support/api'
import { renderInApp } from '../../support/render'

/**
 * Voice notes, transcription and quick notes on the phone (lvn-backend ADR-0062): a recording kept as an audio card and,
 * from the Create sheet, transcribed at once; Transcribe and Tidy into notes on a note's AI screen.
 */
const NOTE = '01920000-0000-7000-8000-00000000a001'
const FILE = '01920000-0000-7000-8000-00000000f0a1'
const RECORDING = '01920000-0000-7000-8000-00000000c0a9'

jest.mock('@/features/notes/store/db', () => ({ getNote: jest.fn(async () => ({ id: NOTE, localOnly: false })), getCards: jest.fn(async () => []), subscribe: () => () => {} }))
jest.mock('@/features/notes/store/actions', () => ({ addCard: jest.fn(async () => ({ id: 'card-voice' })) }))
jest.mock('@/features/notes/sync/engine', () => ({ syncNow: jest.fn(async () => {}) }))
jest.mock('@/features/notes/media/NoteMedia', () => ({ ...jest.requireActual('@/features/notes/media/NoteMedia'), uploadToNote: jest.fn(async () => FILE) }))
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() } }))

const inApollo = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)
const aiState = { data: { aiStatus: { __typename: 'AiStatus', available: true, reason: null }, myAiAllowance: { __typename: 'AiAllowance', usedToday: 0, limitToday: 200_000, resetsAt: '2026-10-14T00:00:00.000Z' } } }
const ran = { data: { runAiTask: { __typename: 'AiArtifactPayload', artifact: { __typename: 'AiArtifact', id: 'a1', task: 'TRANSCRIBE', status: 'QUEUED', language: 'ENGLISH', markdown: null, title: null, cards: null, changes: null, error: null, fromPublishedVersion: false, truncated: false, keptAt: null, createdAt: '2026-10-13T10:00:00.000Z' }, userErrors: [] } } }

beforeEach(() => jest.clearAllMocks())

it('records a voice note, keeps it as an audio card, and queues its transcription', async () => {
  const api = mockApi({ RunAiTask: () => ran })
  await inApollo(<RecordScreen id={NOTE} transcribe />)
  await fireEvent.press(screen.getByRole('button', { name: 'Start recording' }))
  await waitFor(() => expect(jest.mocked(useAudioRecorder).mock.results[0]!.value.record).toHaveBeenCalled())
  await fireEvent.press(await screen.findByRole('button', { name: 'Stop recording' }))
  await fireEvent.press(await screen.findByRole('button', { name: 'Keep it' }))
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith(`/notes/ai/${NOTE}`))
  expect(actions.addCard).toHaveBeenCalledWith(NOTE, 'audio', null, { fileId: FILE })
  expect(syncNow).toHaveBeenCalled()
  expect(api.calls.find((c) => c.op === 'RunAiTask')?.variables).toEqual({ input: { noteId: NOTE, task: 'TRANSCRIBE', cardIds: ['card-voice'] } })
})

it('says how to allow the microphone when it is refused', async () => {
  jest.mocked(requestRecordingPermissionsAsync).mockResolvedValueOnce({ granted: false } as never)
  mockApi({})
  await inApollo(<RecordScreen id={NOTE} />)
  await fireEvent.press(screen.getByRole('button', { name: 'Start recording' }))
  expect(await screen.findByText(/Allow LearnViaNotes to use the microphone/)).toBeOnTheScreen()
})

it('says so when the microphone cannot start', async () => {
  jest.mocked(useAudioRecorder(undefined as never).prepareToRecordAsync).mockRejectedValueOnce(new Error('busy'))
  mockApi({})
  await inApollo(<RecordScreen id={NOTE} />)
  await fireEvent.press(screen.getByRole('button', { name: 'Start recording' }))
  expect(await screen.findByText(/The microphone could not start/)).toBeOnTheScreen()
  expect(screen.queryByRole('button', { name: 'Stop recording' })).toBeNull()
})

it('transcribes a note’s recording and tidies one’s own rough notes from the AI screen', async () => {
  const api = mockApi({
    AiState: () => aiState,
    NoteAiArtifacts: () => ({ data: { note: { __typename: 'Note', id: NOTE, title: 'Lecture 3', viewerCan: { __typename: 'NotePermissions', edit: true, fork: true }, cards: { __typename: 'CardConnection', edges: [{ __typename: 'CardEdge', node: { __typename: 'Card', id: RECORDING, type: 'audio' } }] }, aiArtifacts: [] } } }),
    RunAiTask: () => ran,
  })
  await inApollo(<AiScreen id={NOTE} />)
  await fireEvent.press(await screen.findByRole('button', { name: 'Transcribe the recording' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Tidy into notes' }))
  await waitFor(() => expect(api.calls.filter((c) => c.op === 'RunAiTask')).toHaveLength(2))
  expect(api.calls.filter((c) => c.op === 'RunAiTask').map((c) => c.variables.input)).toEqual([
    { noteId: NOTE, task: 'TRANSCRIBE', language: 'ENGLISH', cardIds: [RECORDING] },
    { noteId: NOTE, task: 'QUICK_NOTE', language: 'ENGLISH' },
  ])
})
