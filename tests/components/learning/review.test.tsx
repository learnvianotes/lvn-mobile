import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { ReviewScreen } from '@/features/learning/ReviewScreen'
import { createApolloClient } from '@/lib/apollo'
import { mockApi } from '../../support/api'
import { renderInApp } from '../../support/render'

/**
 * A review session on the phone (lvn-backend ADR-0068): front, then the back and four grades; Again comes back at the
 * end; grades go to the phone's outbox and then the API in order, each with its own id; offline, the session uses the
 * cards last fetched and the grades wait.
 */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }))
const mockOutbox: { clientOpId: string; cardId: string; rating: string }[] = []
const mockKv = new Map<string, string>()
jest.mock('@/features/notes/store/db', () => ({
  queueGrade: jest.fn(async (g: { clientOpId: string; cardId: string; rating: string }) => void mockOutbox.push(g)),
  waitingGrades: jest.fn(async () => [...mockOutbox]),
  removeGrade: jest.fn(async (id: string) => void mockOutbox.splice(mockOutbox.findIndex((g) => g.clientOpId === id), 1)),
  getValue: jest.fn(async (k: string) => mockKv.get(k) ?? null),
  setValue: jest.fn(async (k: string, v: string) => void mockKv.set(k, v)),
}))

const doc = (text: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] })
const card = (n: number) => ({ __typename: 'ReviewCard', cardId: `01920000-0000-7000-8000-0000000fc00${n}`, noteId: '01920000-0000-7000-8000-00000000a001', noteTitle: 'Heaps', front: doc(`Front ${n}`), back: doc(`Back ${n}`), state: 'NEW', due: null })
const queue = { __typename: 'ReviewQueue', due: 0, new: 2, doneToday: 0, waiting: 4, cards: [card(1), card(2)] }

beforeEach(() => {
  mockOutbox.length = 0
  mockKv.clear()
})

it('reviews today’s cards: Again comes back at the end, each grade sent once with its own id', async () => {
  const api = mockApi({
    ReviewQueue: () => ({ data: { reviewQueue: queue } }),
    ReviewCard: (v) => ({ data: { reviewCard: { __typename: 'ReviewCardPayload', review: { __typename: 'CardReviewResult', cardId: (v.input as { cardId: string }).cardId, due: new Date().toISOString(), state: 'REVIEW', intervalDays: 1 }, userErrors: [] } } }),
  })
  await renderInApp(<ApolloProvider client={createApolloClient()}><ReviewScreen /></ApolloProvider>)
  expect(await screen.findByText('Front 1')).toBeOnTheScreen()
  expect(screen.queryByText('Back 1')).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: 'Show the answer' }))
  expect(screen.getByText('Back 1')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Good' }))
  expect(await screen.findByText('Front 2')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Show the answer' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Again' }))
  expect(await screen.findByText('3 of 3')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Show the answer' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Easy' }))
  expect(await screen.findByText('3 cards reviewed.')).toBeOnTheScreen()
  expect(screen.getByText('4 more cards wait for the next days.')).toBeOnTheScreen()
  await waitFor(() => expect(api.calls.filter((c) => c.op === 'ReviewCard').map((c) => (c.variables.input as { rating: string }).rating)).toEqual(['GOOD', 'AGAIN', 'EASY']))
  expect(new Set(api.calls.filter((c) => c.op === 'ReviewCard').map((c) => (c.variables.input as { clientOpId: string }).clientOpId)).size).toBe(3)
  expect(mockOutbox).toEqual([])
})

it('offline, uses the cards last fetched and keeps the grades for later', async () => {
  mockKv.set('reviewQueue', JSON.stringify({ ...queue, cards: [card(1)] }))
  mockApi({ ReviewQueue: () => new Error('Network request failed'), ReviewCard: () => new Error('Network request failed') })
  await renderInApp(<ApolloProvider client={createApolloClient()}><ReviewScreen /></ApolloProvider>)
  expect(await screen.findByText('Front 1')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Show the answer' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Good' }))
  expect(await screen.findByText('1 grade waits to be sent.')).toBeOnTheScreen()
  expect(mockOutbox.map((g) => g.rating)).toEqual(['GOOD'])
})
