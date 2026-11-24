import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native'
import { router } from 'expo-router'
import { AskScreen } from '@/features/ai/AskAi'
import { AiScreen } from '@/features/ai/AiScreen'
import { NotesListScreen } from '@/features/notes/NotesListScreen'
import { DoubtScreen } from '@/features/workspaces/DoubtScreen'
import { createApolloClient } from '@/lib/apollo'
import { mockApi } from '../../support/api'
import { renderInApp } from '../../support/render'

/**
 * Ask Nova on the phone (lvn-backend ADR-0060): the Ask Nova screen and its scopes, an answer that grows while the model
 * writes, its citations and sources, Ask Nova on one note and on a workspace doubt, the refusals, and the way in.
 */
const ANSWER = '01920000-0000-7000-8000-0000000a5001'
const NOTE = '01920000-0000-7000-8000-00000000a001'
const GRAPHS = '01920000-0000-7000-8000-00000000a0a1'
const DOUBT = '01920000-0000-7000-8000-0000000d0001'

jest.mock('@/features/notes/store/db', () => ({ getCards: jest.fn(async () => []), listNotes: jest.fn(async () => []), excerpts: jest.fn(async () => new Map()), unsentNoteIds: jest.fn(async () => new Set()), outbox: jest.fn(async () => []), subscribe: () => () => {} }))
jest.mock('@/features/notes/store/actions', () => ({ createNote: jest.fn(async () => 'n-new') }))
jest.mock('@/features/notes/sync/engine', () => {
  const idle = { state: 'idle', lastSyncedAt: null }
  return { syncSoon: jest.fn(), syncNow: jest.fn(async () => {}), getSyncStatus: () => idle, subscribeSyncStatus: () => () => {} }
})
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true } }))

const doc = (s: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] })
const answer = (over: Record<string, unknown> = {}) => ({ __typename: 'AiAnswer', id: ANSWER, question: 'How do I find shortest paths?', scope: 'PUBLIC', status: 'READY', text: '', sources: [], error: null, noteId: null, doubtId: null, createdAt: '2026-10-13T10:00:00.000Z', ...over })
const source = (n: number, over: Record<string, unknown> = {}) => ({ __typename: 'AiSource', n, noteId: GRAPHS, title: 'Graphs', versionId: 'v1', cardIds: ['c1'], snippet: 'Dijkstra finds shortest paths with a priority queue.', ...over })
const aiState = (available = true, reason: string | null = null) => ({ data: { aiStatus: { __typename: 'AiStatus', available, reason }, myAiAllowance: { __typename: 'AiAllowance', usedToday: 0, limitToday: 200_000, resetsAt: '2026-10-14T00:00:00.000Z' } } })
const inApollo = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)

beforeEach(() => jest.clearAllMocks())

it('asks public notes from the Ask Nova screen; the answer grows, then cites sources that open their notes', async () => {
  let stage: 'none' | 'writing' | 'done' = 'none'
  let polls = 0
  const current = () => (stage === 'writing' ? answer({ status: 'RUNNING', text: 'Use Dijkstra' }) : answer({ text: 'Use **Dijkstra** with a priority queue [1].', sources: [source(1)] }))
  const api = mockApi({
    AiState: () => aiState(),
    MyAiAnswers: () => ({ data: { myAiAnswers: stage === 'none' ? [] : [current()] } }),
    AskAi: () => ((stage = 'writing'), { data: { askAi: { __typename: 'AskAiPayload', answer: answer({ status: 'QUEUED' }), userErrors: [] } } }),
    // The first poll finds it writing; the next, done.
    AiAnswer: () => (++polls >= 2 && (stage = 'done'), { data: { aiAnswer: current() } }),
  })
  await inApollo(<AskScreen />)
  expect(await screen.findByText('No questions yet.')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('radio', { name: 'Public notes' }))
  expect(screen.getByText('Notes anyone can read on LearnViaNotes.')).toBeOnTheScreen()
  await fireEvent.changeText(screen.getByLabelText('Your question'), 'How do I find shortest paths?')
  await fireEvent.press(screen.getByRole('button', { name: 'Ask' }))
  expect(await screen.findByText('Writing…')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'AskAi')?.variables).toEqual({ input: { question: 'How do I find shortest paths?', scope: 'PUBLIC' } })
  // The poll brings the finished answer.
  await waitFor(() => expect(screen.getByText('Dijkstra')).toBeOnTheScreen(), { timeout: 5000 })
  expect(screen.getByLabelText('Source 1')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('link', { name: 'Source 1: Graphs' }))
  expect(router.push).toHaveBeenCalledWith(`/notes/${GRAPHS}`)
}, 15_000)

it('asks about one note from its AI screen: the draft is the source', async () => {
  let answers: unknown[] = []
  const api = mockApi({
    AiState: () => aiState(),
    NoteAiArtifacts: () => ({ data: { note: { __typename: 'Note', id: NOTE, title: 'Searching', viewerCan: { __typename: 'NotePermissions', edit: true, fork: true }, cards: { __typename: 'CardConnection', edges: [] }, aiArtifacts: [] } } }),
    MyAiAnswers: (v) => ({ data: { myAiAnswers: v.noteId === NOTE ? answers : [] } }),
    AskAi: (v) => {
      answers = [answer({ question: (v.input as { question: string }).question, scope: 'THIS_NOTE', noteId: NOTE, text: 'Halve the range each step [1].', sources: [source(1, { noteId: NOTE, title: 'Searching', versionId: null, snippet: 'Halve the range.' })] })]
      return { data: { askAi: { __typename: 'AskAiPayload', answer: answers[0], userErrors: [] } } }
    },
  })
  await inApollo(<AiScreen id={NOTE} />)
  await fireEvent.changeText(await screen.findByLabelText('Ask about this note'), 'How does binary search work?')
  await fireEvent.press(screen.getByRole('button', { name: 'Ask' }))
  expect(await screen.findByText('Searching · draft')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'AskAi')?.variables).toEqual({ input: { question: 'How does binary search work?', scope: 'THIS_NOTE', noteId: NOTE } })
})

it('asks AI about a workspace doubt, over the workspace’s notes', async () => {
  let answers: unknown[] = []
  const api = mockApi({
    AiState: () => aiState(),
    Doubt: () => ({
      data: {
        doubt: {
          __typename: 'Doubt', moderation: 'OK', moderationReason: null, moderationCanAppeal: false, id: DOUBT, title: 'Why swap twice?', status: 'OPEN', repoRef: null, createdAt: '2026-10-13T10:00:00.000Z', answerCount: 0,
          author: { __typename: 'User', id: 'u1', displayName: 'Asha Rao', handle: 'asha' }, body: doc('See the loop'), resolvedAt: null, answers: [],
          viewerCan: { __typename: 'DoubtActions', answer: true, resolve: true, reopen: false, delete: true },
        },
      },
    }),
    MyAiAnswers: (v) => ({ data: { myAiAnswers: v.doubtId === DOUBT ? answers : [] } }),
    AskAiAboutDoubt: () => {
      answers = [answer({ question: 'Why swap twice?', scope: 'WORKSPACE', doubtId: DOUBT, text: 'It swaps with the smaller child [1].', sources: [source(1, { title: 'Team notes' })] })]
      return { data: { askAiAboutDoubt: { __typename: 'AskAiPayload', answer: answers[0], userErrors: [] } } }
    },
  })
  await inApollo(<DoubtScreen id={DOUBT} />)
  await fireEvent.press(await screen.findByRole('button', { name: 'Ask Nova about this doubt' }))
  expect(await screen.findByRole('link', { name: 'Source 1: Team notes' })).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'AskAiAboutDoubt')?.variables).toEqual({ doubtId: DOUBT })
})

it('says why AI cannot answer, shows a failed answer, and deletes one', async () => {
  let answers: unknown[] = [answer({ status: 'FAILED', error: 'AI is not answering right now. Try again in a minute.' })]
  const api = mockApi({
    AiState: () => aiState(false, 'PROVIDER_DOWN'),
    MyAiAnswers: () => ({ data: { myAiAnswers: answers } }),
    DeleteAiAnswer: () => ((answers = []), { data: { deleteAiAnswer: { __typename: 'OkPayload', ok: true, userErrors: [] } } }),
  })
  await inApollo(<AskScreen />)
  expect(await screen.findByText('Nova isn’t answering right now. Try again in a minute.')).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Ask' })).toBeDisabled()
  const failed = await screen.findByLabelText('Answer: How do I find shortest paths?')
  expect(within(failed).getByText('AI is not answering right now. Try again in a minute.')).toBeOnTheScreen()
  await fireEvent.press(within(failed).getByRole('button', { name: 'Delete this answer' }))
  await waitFor(() => expect(screen.queryByLabelText('Answer: How do I find shortest paths?')).toBeNull())
  expect(api.calls.find((c) => c.op === 'DeleteAiAnswer')?.variables).toEqual({ id: ANSWER })
})

it('My notes leads to Ask Nova', async () => {
  mockApi({})
  await inApollo(<NotesListScreen />)
  await fireEvent.press(await screen.findByRole('button', { name: 'Ask Nova' }))
  expect(router.push).toHaveBeenCalledWith('/ask')
})
