import { ApolloProvider } from '@apollo/client/react'
import { router } from 'expo-router'
import { fireEvent, screen } from '@testing-library/react-native'
import { RhythmCard } from '@/features/home/RhythmCard'
import { createApolloClient } from '@/lib/apollo'
import { mockApi } from '../../support/api'
import { renderInApp } from '../../support/render'

/** Rhythm on Home (ADR-0030, lvn-backend ADR-0069): today's ring and what fills it, the week, and the counter. */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }))

const plan = [1, 2, 4, 6]
const statuses = ['COUNTED', 'MISSED', 'REST', 'TODAY', 'AHEAD', 'AHEAD', 'AHEAD'] as const
const rhythm = (today: Record<string, unknown> = {}) => ({
  __typename: 'Rhythm', timeZone: 'UTC', plannedDays: plan, target: 4, countedDays: 1, met: false, shareRhythm: false, suggestion: null,
  week: statuses.map((status, i) => ({ __typename: 'RhythmDay', day: `2026-10-${String(12 + i).padStart(2, '0')}`, weekday: i + 1, planned: plan.includes(i + 1), counted: status === 'COUNTED', status })),
  today: { __typename: 'RhythmToday', day: '2026-10-15', learningSeconds: 0, reviews: 6, counted: false, comeback: false, cameBack: false, items: [{ __typename: 'RhythmItem', kind: 'REVIEWS', done: 6, total: 14, title: null, topicKey: null }, { __typename: 'RhythmItem', kind: 'WEAK_TOPIC', done: 0, total: 1, title: 'Deadlocks', topicKey: 'topic:x' }], ...today },
  weeksThisTerm: 9, weeksAllTime: 20, countedDaysAllTime: 80, pauses: [], pauseDaysLeft: 14,
})
const show = () => renderInApp(<ApolloProvider client={createApolloClient()}><RhythmCard /></ApolloProvider>)

it('shows today’s ring and what fills it, the week and the counter; opens Rhythm', async () => {
  mockApi({ Rhythm: () => ({ data: { rhythm: rhythm() } }) })
  await show()
  expect(await screen.findByLabelText('Today’s ring: 60% of the way to a counted day')).toBeOnTheScreen()
  expect(screen.getByText('Reviews: 6 of 14')).toBeOnTheScreen()
  expect(screen.getByText('Weak topic: Deadlocks')).toBeOnTheScreen()
  expect(screen.getByText('10 learning minutes or 10 reviews and today counts')).toBeOnTheScreen()
  expect(screen.getByLabelText('Tuesday: planned, not counted')).toBeOnTheScreen()
  expect(screen.getByText(/1 of 4 planned days this week · Rhythm weeks this term: 9/)).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('link'))
  expect(router.push).toHaveBeenCalledWith('/rhythm')
})

it('says the day counted', async () => {
  mockApi({ Rhythm: () => ({ data: { rhythm: rhythm({ reviews: 10, counted: true }) } }) })
  await show()
  expect(await screen.findByText('Day counted')).toBeOnTheScreen()
})
