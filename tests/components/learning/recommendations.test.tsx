import { ApolloProvider } from '@apollo/client/react'
import { router } from 'expo-router'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { Recommendations } from '@/features/learning/Recommendations'
import { createApolloClient } from '@/lib/apollo'
import { mockApi } from '../../support/api'
import { renderInApp } from '../../support/render'

/** Recommendations on the phone (lvn-backend ADR-0071): each with why; a note opens; one can be set aside. */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }))

const NOTE = '01920000-0000-7000-8000-00000000a001'
const TOPIC = '01920000-0000-7000-8000-0000000070a1'
const rec = (over: Record<string, unknown>) => ({ __typename: 'Recommendation', score: 50, noteTitle: null, topicKey: null, topicTitle: null, note: null, topic: null, ...over })

it('shows recommendations with why; a note opens, and one can be set aside', async () => {
  let items = [
    rec({ kind: 'EXAM_TOPIC', score: 95, reason: 'On your plan for Operating Systems, in 5 days', topicKey: `topic:${TOPIC}`, topicTitle: 'Paging', topic: { __typename: 'Topic', id: TOPIC } }),
    rec({ kind: 'CONTINUE_NOTE', score: 55, reason: 'You were reading this on Monday, 12 October', noteTitle: 'Dijkstra', note: { __typename: 'Note', id: NOTE } }),
  ]
  const api = mockApi({
    Recommendations: () => ({ data: { recommendations: items } }),
    DismissRecommendation: () => {
      items = items.slice(1)
      return { data: { dismissRecommendation: { __typename: 'OkPayload', ok: true, userErrors: [] } } }
    },
  })
  await renderInApp(<ApolloProvider client={createApolloClient()}><Recommendations /></ApolloProvider>)
  expect(await screen.findByText('On your plan for Operating Systems, in 5 days')).toBeOnTheScreen()
  await fireEvent.press(screen.getByText('Dijkstra'))
  expect(router.push).toHaveBeenCalledWith(`/notes/${NOTE}`)
  await fireEvent.press(screen.getByRole('button', { name: 'Not now: Paging' }))
  await waitFor(() => expect(api.calls.find((c) => c.op === 'DismissRecommendation')?.variables).toEqual({ input: { kind: 'EXAM_TOPIC', entityId: `topic:${TOPIC}` } }))
  await waitFor(() => expect(screen.queryByText('Paging')).toBeNull())
})
