import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native'
import { router } from 'expo-router'
import { Alert } from 'react-native'
import { AiScreen } from '@/features/ai/AiScreen'
import { AccountScreen } from '@/features/auth/AccountScreen'
import { MediaProvider } from '@/features/notes/media/NoteMedia'
import { NoteScreen } from '@/features/notes/NoteScreen'
import type { LocalNote } from '@/features/notes/model/types'
import { syncNow } from '@/features/notes/sync/engine'
import { createApolloClient } from '@/lib/apollo'
import { mockApi, viewer, type Handler } from '../../support/api'
import { renderInApp } from '../../support/render'

/**
 * AI tasks on the phone (lvn-backend ADR-0059): running a task and waiting for it, Markdown results, keeping cards
 * into the note or a new note of one's own, failures, AI being off and the day's allowance, and the way in from a note.
 */
const NOTE = '01920000-0000-7000-8000-00000000a001'
const ME = '01920000-0000-7000-8000-00000000aaaa'
const ART = '01920000-0000-7000-8000-0000000a1001'
const NEW_NOTE = '01920000-0000-7000-8000-00000000a0ff'
let mockNotes: LocalNote[] = []
let mockCards: { id: string; noteId: string; type: string; position: string; revision: number; content: unknown; dirty: boolean; deleted: boolean }[] = []

jest.mock('@/features/notes/store/db', () => ({
  getNote: jest.fn(async (id: string) => mockNotes.find((n) => n.id === id) ?? null),
  getCards: jest.fn(async () => mockCards),
  listNotes: jest.fn(async () => []),
  unsentNoteIds: jest.fn(async () => new Set()),
  outbox: jest.fn(async () => []),
  subscribe: () => () => {},
}))
jest.mock('@/features/notes/store/actions', () => ({}))
jest.mock('@/features/notes/sync/engine', () => {
  const idle = { state: 'idle', lastSyncedAt: null }
  return { syncSoon: jest.fn(), syncNow: jest.fn(async () => {}), getSyncStatus: () => idle, subscribeSyncStatus: () => () => {} }
})
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }, Link: ({ children }: { children: React.ReactNode }) => children }))

const p = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
const artifact = (over: Record<string, unknown> = {}) => ({
  __typename: 'AiArtifact',
  id: ART,
  task: 'SUMMARIZE',
  status: 'READY',
  language: 'ENGLISH',
  markdown: null,
  title: null,
  cards: null,
  error: null,
  fromPublishedVersion: false,
  truncated: false,
  keptAt: null,
  createdAt: '2026-10-13T10:00:00.000Z',
  ...over,
})
const aiCard = (type: string, content: unknown) => ({ __typename: 'AiCard', type, content })
const flashcard = (front: string, back: string) => aiCard('flashcard', { front: { type: 'doc', content: [p(front)] }, back: { type: 'doc', content: [p(back)] } })
const aiState = (over: { available?: boolean; reason?: string | null; usedToday?: number } = {}) => ({
  data: {
    aiStatus: { __typename: 'AiStatus', available: over.available ?? true, reason: over.reason ?? null },
    myAiAllowance: { __typename: 'AiAllowance', usedToday: over.usedToday ?? 20_000, limitToday: 200_000, resetsAt: '2026-10-14T00:00:00.000Z' },
  },
})
const noteAi = (list: unknown[], can: { edit: boolean; fork: boolean } = { edit: true, fork: true }) => ({
  data: { note: { __typename: 'Note', id: NOTE, title: 'Binary search', viewerCan: { __typename: 'NotePermissions', ...can }, cards: { __typename: 'CardConnection', edges: [] }, aiArtifacts: list } },
})
const ran = (a: unknown) => ({ data: { runAiTask: { __typename: 'RunAiTaskPayload', artifact: a, userErrors: [] } } })
const kept = (noteId: string) => ({ data: { keepAiCards: { __typename: 'KeepAiCardsPayload', noteId, userErrors: [] } } })

const inApollo = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)
const open = async (handlers: Record<string, Handler>) => {
  const api = mockApi({ AiState: () => aiState(), ...handlers })
  await inApollo(<AiScreen id={NOTE} />)
  return api
}
const result = (label: string) => screen.getByLabelText(`${label} result`)

beforeEach(() => {
  jest.clearAllMocks()
  mockNotes = []
  mockCards = []
})

it('runs a task, says it is working, then shows the result as Markdown', async () => {
  let polls = 0
  const api = await open({
    NoteAiArtifacts: () => noteAi([]),
    RunAiTask: () => ran(artifact({ status: 'QUEUED' })),
    AiArtifact: () => ({ data: { aiArtifact: ++polls < 2 ? artifact({ status: 'RUNNING' }) : artifact({ markdown: 'Binary search **halves** the range.\n\n- Needs sorted input\n- Takes O(log n) steps' }) } }),
  })
  expect(await screen.findByText('Nothing yet. Pick a task above; results take a few seconds.')).toBeOnTheScreen()
  expect(screen.getByText(/Today’s AI allowance: 10% used/)).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Summarise' }))
  expect(await screen.findByText(/Waiting its turn…|Working on it…/)).toBeOnTheScreen()
  await waitFor(() => expect(screen.getByText('Needs sorted input')).toBeOnTheScreen(), { timeout: 6000 })
  expect(within(result('Summarise')).getByText('halves')).toBeOnTheScreen()
  expect(within(result('Summarise')).getByText('Takes O(log n) steps')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'RunAiTask')?.variables).toEqual({ input: { noteId: NOTE, task: 'SUMMARIZE', language: 'ENGLISH' } })
  expect(polls).toBeGreaterThanOrEqual(2)
}, 15_000)

it('previews flashcards, drops one and adds the rest to the note, which the phone then pulls', async () => {
  const api = await open({
    NoteAiArtifacts: () => noteAi([artifact({ task: 'FLASHCARDS', title: 'Flashcards — Binary search', cards: [flashcard('What does it need?', 'Sorted input'), flashcard('Its running time?', 'O(log n)'), flashcard('What is halved?', 'The range')] })]),
    KeepAiCards: () => kept(NOTE),
  })
  expect(await screen.findByText('What does it need?')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Keep card 2' }))
  expect(screen.getByRole('checkbox', { name: 'Keep card 2' })).not.toBeChecked()
  await fireEvent.press(screen.getByRole('button', { name: 'Add 2 cards to this note' }))
  expect(await screen.findByText('Added to this note.')).toBeOnTheScreen()
  expect(screen.getByText('Kept')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'KeepAiCards')?.variables).toEqual({ input: { artifactId: ART, cardIndexes: [0, 2], into: 'NOTE' } })
  expect(syncNow).toHaveBeenCalled()
})

it('a reader saves a quiz as a note of their own and opens it; tasks that copy the note need the right to', async () => {
  const quiz = aiCard('quiz', { question: { type: 'doc', content: [p('Its running time?')] }, choices: [{ id: 'c1', content: [{ type: 'text', text: 'O(n)' }] }, { id: 'c2', content: [{ type: 'text', text: 'O(log n)' }] }], correct: ['c2'], multiple: false })
  const api = await open({
    NoteAiArtifacts: () => noteAi([artifact({ task: 'QUIZ', title: 'Quiz — Binary search', cards: [quiz], fromPublishedVersion: true })], { edit: false, fork: false }),
    KeepAiCards: () => kept(NEW_NOTE),
  })
  expect(await screen.findByText('Its running time?')).toBeOnTheScreen()
  expect(screen.getByText('Made from the published version.')).toBeOnTheScreen()
  expect(screen.queryByRole('button', { name: 'Make notes' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Outline → note' })).toBeNull()
  expect(screen.queryByRole('button', { name: /to this note/ })).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: 'Save 1 card as my note' }))
  expect(await screen.findByText('Saved as a new private note.')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'KeepAiCards')?.variables).toEqual({ input: { artifactId: ART, cardIndexes: [0], into: 'NEW_NOTE' } })
  // The phone pulls the new note first, so it opens as the person's own.
  expect(syncNow).toHaveBeenCalled()
  await fireEvent.press(screen.getByRole('button', { name: 'Open it' }))
  expect(router.push).toHaveBeenCalledWith(`/notes/${NEW_NOTE}`)
})

it('offers code help only for a note with code cards', async () => {
  mockCards = [{ id: 'c1', noteId: NOTE, type: 'text', position: 'a0', revision: 1, content: { doc: { type: 'doc', content: [p('Prose only')] } }, dirty: false, deleted: false }]
  await open({ NoteAiArtifacts: () => noteAi([]) })
  expect(await screen.findByRole('button', { name: 'Summarise' })).toBeOnTheScreen()
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Explain the code' })).toBeNull())
})

it('a failed result says why and runs again; translating sends the language; a result can be deleted', async () => {
  let list: unknown[] = [artifact({ status: 'FAILED', error: 'The AI model gave an answer that could not be used. Try again.' })]
  const api = await open({
    NoteAiArtifacts: () => noteAi(list),
    RunAiTask: (v) => {
      const input = v.input as { task: string; language: string }
      return ran(artifact({ id: input.task === 'TRANSLATE' ? 'a-translate' : 'a-again', task: input.task, language: input.language, markdown: 'Done.' }))
    },
    DeleteAiArtifact: () => ((list = []), { data: { deleteAiArtifact: { __typename: 'OkPayload', ok: true, userErrors: [] } } }),
  })
  expect(await screen.findByText('The AI model gave an answer that could not be used. Try again.')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }))
  await fireEvent.press(screen.getByRole('radio', { name: 'Telugu' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Translate' }))
  expect(await screen.findByLabelText('Translated into Telugu result')).toBeOnTheScreen()
  expect(api.calls.filter((c) => c.op === 'RunAiTask').map((c) => c.variables.input)).toEqual([
    { noteId: NOTE, task: 'SUMMARIZE', language: 'ENGLISH' },
    { noteId: NOTE, task: 'TRANSLATE', language: 'TELUGU' },
  ])
  const failed = screen.getAllByLabelText('Summarise result').find((r) => within(r).queryByText(/could not be used/))!
  await fireEvent.press(within(failed).getByRole('button', { name: 'Delete this result' }))
  await waitFor(() => expect(screen.queryByText(/could not be used/)).toBeNull())
  expect(api.calls.find((c) => c.op === 'DeleteAiArtifact')?.variables).toEqual({ id: ART })
})

it('AI that is off says why and its tasks wait', async () => {
  mockApi({ AiState: () => aiState({ available: false, reason: 'PROVIDER_DOWN' }), NoteAiArtifacts: () => noteAi([]) })
  await inApollo(<AiScreen id={NOTE} />)
  expect(await screen.findByText('The AI model isn’t answering right now. Try again in a minute.')).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Summarise' })).toBeDisabled()
})

it('a spent allowance stops new tasks, and the server’s refusal is shown in its words', async () => {
  const api = mockApi({ AiState: () => aiState({ usedToday: 200_000 }), NoteAiArtifacts: () => noteAi([]) })
  const view = await inApollo(<AiScreen id={NOTE} />)
  expect(await screen.findByText(/You’ve used today’s AI allowance/)).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Quiz' })).toBeDisabled()
  await view.unmount()

  mockApi({
    AiState: () => aiState({ usedToday: 199_000 }),
    NoteAiArtifacts: () => noteAi([]),
    RunAiTask: () => ({ data: { runAiTask: { __typename: 'RunAiTaskPayload', artifact: null, userErrors: [{ __typename: 'UserError', field: null, message: 'You’ve used today’s AI allowance; it comes back at midnight UTC.', code: 'RATE_LIMITED' }] } } }),
  })
  await inApollo(<AiScreen id={NOTE} />)
  await fireEvent.press(await screen.findByRole('button', { name: 'Quiz' }))
  expect(await screen.findByText('You’ve used today’s AI allowance; it comes back at midnight UTC.')).toBeOnTheScreen()
  expect(api.ops()).not.toContain('RunAiTask')
})

it('a note opens its AI tasks from its header; one made here waits until it has been sent', async () => {
  const note = (over: Partial<LocalNote>): LocalNote => ({ id: NOTE, title: 'Binary search', kind: 'NOTE', folderId: null, folderName: null, tags: [], ownerId: ME, ownerName: 'Asha Rao', access: 'OWNER', visibility: 'PRIVATE', publishedAt: null, deletedAt: null, updatedAt: '2026-10-13T10:00:00.000Z', localOnly: false, titleDirty: false, pendingTrash: null, ...over })
  mockApi({ PhoneNoteMeta: () => ({ data: { note: null } }) })
  mockNotes = [note({})]
  const view = await inApollo(<NoteScreen id={NOTE} />)
  await fireEvent.press(await screen.findByRole('button', { name: 'AI tasks' }))
  expect(router.push).toHaveBeenCalledWith(`/notes/ai/${NOTE}`)
  await view.unmount()

  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  mockNotes = [note({ localOnly: true })]
  await inApollo(<NoteScreen id={NOTE} />)
  await fireEvent.press(await screen.findByRole('button', { name: 'AI tasks' }))
  expect(alert).toHaveBeenCalledWith('Not sent yet', 'The note is still only on this phone. Once it has been sent, AI can read it.')
  expect(router.push).toHaveBeenCalledTimes(1)
})

it('the account screen shows today’s AI allowance, or why AI is off', async () => {
  const account = { Viewer: () => ({ data: { viewer: viewer() } }), MyDataExports: () => ({ data: { myDataExports: [] } }), MyStanding: () => ({ data: { myStanding: { __typename: 'AccountStanding', suspendedUntil: null, suspensionReason: null, canAppeal: false, warnings: [] } } }) }
  mockApi({ ...account, AiState: () => aiState({ usedToday: 150_000 }) })
  const view = await inApollo(<AccountScreen />)
  expect(await screen.findByText(/Today’s AI allowance: 75% used/)).toBeOnTheScreen()
  expect(screen.getByRole('progressbar', { name: 'Today’s AI allowance' })).toHaveAccessibilityValue({ min: 0, max: 200_000, now: 150_000 })
  await view.unmount()

  mockApi({ ...account, AiState: () => aiState({ available: false, reason: 'BUDGET' }) })
  await inApollo(<AccountScreen />)
  expect(await screen.findByText('AI is resting until next month: this month’s AI budget is used up.')).toBeOnTheScreen()
})

it('stays on the note when another query of it is refused (a refused answer is not cached over the note)', async () => {
  let mediaCalls = 0
  mockApi({
    AiState: () => aiState(),
    NoteAiArtifacts: () => noteAi([artifact({ markdown: 'A heap keeps the smallest item on top.' })]),
    // The phone's media query once asked for more cards than the API gives at once: refused, with `note: null`.
    PhoneNoteMedia: () =>
      ++mediaCalls > 1
        ? { data: { note: null }, errors: [{ message: 'Ask for between 1 and 100 items.', path: ['note', 'cards'], extensions: { code: 'VALIDATION' } }] }
        : { data: { note: { __typename: 'Note', id: NOTE, cards: { __typename: 'CardConnection', edges: [], pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: null } } } } },
  })
  const client = createApolloClient()
  const ui = (cardIds: string) => (
    <ApolloProvider client={client}>
      <MediaProvider noteId={NOTE} cardIds={cardIds}>
        <AiScreen id={NOTE} />
      </MediaProvider>
    </ApolloProvider>
  )
  const view = await renderInApp(ui('c1'))
  expect(await screen.findByText('A heap keeps the smallest item on top.')).toBeOnTheScreen()
  // Cards changed (kept AI cards arrived by sync): the media are asked for again, and refused.
  await view.rerender(ui('c1,c2'))
  await waitFor(() => expect(mediaCalls).toBeGreaterThan(1))
  expect(screen.getByText('A heap keeps the smallest item on top.')).toBeOnTheScreen()
  expect(screen.getByText(/Ask AI about/)).toBeOnTheScreen()
})
