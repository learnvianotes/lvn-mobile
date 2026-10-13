import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen } from '@testing-library/react-native'
import { router } from 'expo-router'
import { HistoryScreen } from '@/features/learning/HistoryScreen'
import { createApolloClient } from '@/lib/apollo'
import { mockApi } from '../../support/api'
import { renderInApp } from '../../support/render'

/** Learning history on the phone (lvn-backend ADR-0067): days with their time, Rhythm days, topics, readable notes. */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }))

const NOTE = '01920000-0000-7000-8000-00000000a001'
const day = (over: Record<string, unknown>) => ({ __typename: 'LearningHistoryDay', learningSeconds: 0, readingSeconds: 0, reviews: 0, quizAnswers: 0, counted: false, topics: [], notes: [], ...over })

it('shows the days with their time, what counts for Rhythm, topics and notes; older days on request', async () => {
  const api = mockApi({
    LearningHistory: (v) => ({
      data: {
        learningHistory: v.before
          ? { __typename: 'LearningHistory', timeZone: 'Asia/Kolkata', nextBefore: null, days: [day({ day: '2026-10-02', readingSeconds: 1200 })] }
          : {
              __typename: 'LearningHistory',
              timeZone: 'Asia/Kolkata',
              nextBefore: '2026-10-10',
              days: [
                day({ day: '2026-10-12', learningSeconds: 660, reviews: 12, counted: true, topics: [{ __typename: 'LearningHistoryTopic', key: 'core:dsa-basics/arrays', seconds: 300, topic: null }], notes: [{ __typename: 'Note', id: NOTE, title: 'Dijkstra' }, null] }),
                day({ day: '2026-10-10', quizAnswers: 5 }),
              ],
            },
      },
    }),
  })
  await renderInApp(<ApolloProvider client={createApolloClient()}><HistoryScreen /></ApolloProvider>)
  expect(await screen.findByText('Days are counted in Asia/Kolkata and start at 4 in the morning.')).toBeOnTheScreen()
  expect(screen.getByText('Learning 11 min · 12 cards reviewed')).toBeOnTheScreen()
  expect(screen.getAllByText('Counts for your Rhythm')).toHaveLength(1)
  expect(screen.getByText('dsa basics / arrays · 5 min')).toBeOnTheScreen()
  expect(screen.getByText('5 quiz answers')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('link', { name: 'Dijkstra' }))
  expect(router.push).toHaveBeenCalledWith(`/notes/${NOTE}`)
  await fireEvent.press(screen.getByRole('button', { name: 'Older days' }))
  expect(await screen.findByText('Reading 20 min')).toBeOnTheScreen()
  expect(api.calls.filter((c) => c.op === 'LearningHistory').at(-1)!.variables).toEqual({ before: '2026-10-10', days: 14 })
})
