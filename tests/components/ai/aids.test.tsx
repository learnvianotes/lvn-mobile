import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import { StudyAids } from '@/features/ai/StudyAids'
import { syncNow } from '@/features/notes/sync/engine'
import { createApolloClient } from '@/lib/apollo'
import { mockApi } from '../../support/api'
import { renderInApp } from '../../support/render'

/** A public note's study aids on the phone (lvn-backend ADR-0061): readers try and keep them; the owner follows and hides. */
const NOTE = '01920000-0000-7000-8000-00000000a001'
const NEW_NOTE = '01920000-0000-7000-8000-00000000a0ff'

jest.mock('@/features/notes/sync/engine', () => ({ syncNow: jest.fn(async () => {}) }))
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }))

const p = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
const insight = (task: string, over: Record<string, unknown> = {}) => ({ __typename: 'AiInsight', id: `aid-${task}`, task, status: 'READY', markdown: null, title: null, cards: null, hidden: false, versionId: 'v1', ...over })
const quiz = { __typename: 'AiCard', type: 'quiz', content: { question: { type: 'doc', content: [p('Its running time?')] }, choices: [{ id: 'c1', content: [{ type: 'text', text: 'O(n)' }] }, { id: 'c2', content: [{ type: 'text', text: 'O(log n)' }] }], correct: ['c2'], multiple: false } }
const answer = (aids: unknown[], status: unknown = null) => ({ data: { note: { __typename: 'Note', id: NOTE, noteProcessingStatus: status, aiInsights: aids } } })
const inApollo = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)

beforeEach(() => jest.clearAllMocks())

it('a reader reads the summary, tries the quiz and keeps it as their own note', async () => {
  const api = mockApi({
    NoteInsights: () => answer([insight('SUMMARIZE', { markdown: 'Binary search **halves** the range.' }), insight('QUIZ', { title: 'Quiz — Searching', cards: [quiz] })]),
    KeepAiCards: () => ({ data: { keepAiCards: { __typename: 'KeepAiCardsPayload', noteId: NEW_NOTE, userErrors: [] } } }),
  })
  await inApollo(<StudyAids noteId={NOTE} />)
  expect(await screen.findByText('halves')).toBeOnTheScreen()
  expect(screen.queryByRole('button', { name: 'Hide from readers' })).toBeNull()
  await fireEvent.press(screen.getByRole('tab', { name: 'Quiz' }))
  expect(screen.getByText('Its running time?')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Save as my note' }))
  expect(await screen.findByText('Saved as a new private note.')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'KeepAiCards')?.variables).toEqual({ input: { artifactId: 'aid-QUIZ', cardIndexes: [0], into: 'NEW_NOTE' } })
  expect(syncNow).toHaveBeenCalled()
  await fireEvent.press(screen.getByRole('button', { name: 'Open it' }))
  expect(router.push).toHaveBeenCalledWith(`/notes/${NEW_NOTE}`)
})

it('the owner sees an aid being made until it is ready, and hides one from readers', async () => {
  let polls = 0
  let hidden = false
  const status = (done: boolean) => ({ __typename: 'NoteProcessing', versionId: 'v1', done, steps: [] })
  const api = mockApi({
    NoteInsights: () => {
      const done = ++polls > 2
      return answer([insight('SUMMARIZE', { markdown: 'Halve the range.', hidden }), insight('FLASHCARDS', done ? { cards: [{ __typename: 'AiCard', type: 'flashcard', content: { front: { type: 'doc', content: [p('Halve what?')] }, back: { type: 'doc', content: [p('The range')] } } }] } : { status: 'RUNNING' })], status(done))
    },
    SetAiInsightHidden: (v) => ((hidden = v.hidden as boolean), { data: { setAiInsightHidden: { __typename: 'OkPayload', ok: true, userErrors: [] } } }),
  })
  await inApollo(<StudyAids noteId={NOTE} />)
  expect(await screen.findByText(/Made by Nova from your published note/)).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('tab', { name: 'Flashcards' }))
  expect(screen.getByText('Being made…')).toBeOnTheScreen()
  await waitFor(() => expect(screen.getByText('Halve what?')).toBeOnTheScreen(), { timeout: 8000 })
  await fireEvent.press(screen.getByRole('tab', { name: 'Summarise' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Hide from readers' }))
  expect(await screen.findByText('Hidden from readers')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'SetAiInsightHidden')?.variables).toEqual({ id: 'aid-SUMMARIZE', hidden: true })
}, 15_000)
