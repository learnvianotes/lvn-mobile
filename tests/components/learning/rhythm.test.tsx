import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { RhythmScreen } from '@/features/learning/RhythmScreen'
import { createApolloClient } from '@/lib/apollo'
import { mockApi } from '../../support/api'
import { renderInApp } from '../../support/render'

/**
 * Rhythm on the phone (lvn-backend ADR-0030, ADR-0069): today's ring and what is left, a comeback, the week (never
 * red: a missed day is "not counted"), the counters, the plan of 3–6 days, and pauses from today or tomorrow.
 */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }))

const PAUSE = '01920000-0000-7000-8000-0000000000a1'
const statuses = ['COUNTED', 'MISSED', 'REST', 'TODAY', 'AHEAD', 'AHEAD', 'AHEAD'] as const
const plan = [1, 2, 4, 6]
const rhythm = (over: Record<string, unknown> = {}, today: Record<string, unknown> = {}) => ({
  __typename: 'Rhythm',
  timeZone: 'Asia/Kolkata',
  plannedDays: plan,
  target: 4,
  countedDays: 1,
  met: false,
  week: statuses.map((status, i) => ({ __typename: 'RhythmDay', day: `2026-10-${String(12 + i).padStart(2, '0')}`, weekday: i + 1, planned: plan.includes(i + 1), counted: status === 'COUNTED', status })),
  today: { __typename: 'RhythmToday', day: '2026-10-15', learningSeconds: 240, reviews: 3, counted: false, comeback: true, cameBack: false, items: [{ __typename: 'RhythmItem', kind: 'REVIEWS', done: 3, total: 8, title: null, topicKey: null }], ...today },
  weeksThisTerm: 9,
  weeksAllTime: 23,
  countedDaysAllTime: 140,
  pauses: [],
  pauseDaysLeft: 14,
  suggestion: null,
  ...over,
})
const ok = (name: string, userErrors: unknown[] = []) => ({ data: { [name]: { __typename: 'OkPayload', ok: !userErrors.length, userErrors } } })
const show = () => renderInApp(<ApolloProvider client={createApolloClient()}><RhythmScreen /></ApolloProvider>)

it('shows today’s ring and what is left, a comeback, the week and the counters', async () => {
  mockApi({ Rhythm: () => ({ data: { rhythm: rhythm() } }) })
  await show()
  expect(await screen.findByLabelText('Today’s ring: 40% of the way to a counted day')).toBeOnTheScreen()
  expect(screen.getByText('Comeback day: the same 10 minutes put you back on rhythm.')).toBeOnTheScreen()
  expect(screen.getByText('6 more learning minutes, or 7 more reviews, and today counts.')).toBeOnTheScreen()
  expect(screen.getByLabelText('Monday: counted, planned')).toBeOnTheScreen()
  expect(screen.getByLabelText('Tuesday: planned, not counted')).toBeOnTheScreen()
  expect(screen.getByLabelText('Wednesday: rest day')).toBeOnTheScreen()
  expect(screen.getByLabelText('Thursday: today, planned')).toBeOnTheScreen()
  expect(screen.getByText('1 of 4 days this week')).toBeOnTheScreen()
  expect(screen.getByLabelText('Days counted all time: 140')).toBeOnTheScreen()
  expect(screen.queryByText(/lost/i)).toBeNull()
})

it('shows today’s revision and a weak topic, and suggests a day more before an exam', async () => {
  mockApi({
    Rhythm: () => ({
      data: {
        rhythm: rhythm(
          { suggestion: { __typename: 'RhythmSuggestion', plannedDays: 5, examId: PAUSE, examName: 'Operating Systems', daysLeft: 12 } },
          { items: [{ __typename: 'RhythmItem', kind: 'PLAN_TASK', done: 0, total: 1, title: 'Operating Systems', topicKey: null }, { __typename: 'RhythmItem', kind: 'WEAK_TOPIC', done: 0, total: 1, title: 'Paging', topicKey: 'topic:x' }] },
        ),
      },
    }),
  })
  await show()
  expect(await screen.findByText('Revision for Operating Systems: 0 of 1')).toBeOnTheScreen()
  expect(screen.getByText('Weak topic: Paging')).toBeOnTheScreen()
  expect(screen.getByText('Operating Systems is in 12 days: try 5 planned days a week until then.')).toBeOnTheScreen()
})

it('says back on rhythm when a comeback day counts, and a met week', async () => {
  mockApi({ Rhythm: () => ({ data: { rhythm: rhythm({ met: true, countedDays: 4 }, { learningSeconds: 700, counted: true, comeback: false, cameBack: true }) } }) })
  await show()
  expect(await screen.findByText('Back on rhythm.')).toBeOnTheScreen()
  expect(screen.getByText('Today counts')).toBeOnTheScreen()
  expect(screen.getByText('Week met')).toBeOnTheScreen()
  expect(screen.queryByText(/and today counts/)).toBeNull()
})

it('changes the planned days, 3 to 6 of them', async () => {
  let current = rhythm()
  const api = mockApi({
    Rhythm: () => ({ data: { rhythm: current } }),
    SetRhythmPlan: (v) => {
      const days = (v.input as { plannedDays: number[] }).plannedDays
      current = rhythm({ plannedDays: days, target: days.length })
      return ok('setRhythmPlan')
    },
  })
  await show()
  await screen.findByText('Your planned days')
  await fireEvent.press(screen.getByRole('button', { name: 'Tuesday' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Thursday' }))
  expect(screen.getByRole('button', { name: 'Save days' })).toBeDisabled()
  await fireEvent.press(screen.getByRole('button', { name: 'Wednesday' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Friday' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Save days' }))
  await waitFor(() => expect(api.calls.find((c) => c.op === 'SetRhythmPlan')?.variables).toEqual({ input: { plannedDays: [1, 3, 5, 6] } }))
  expect(await screen.findByText('Saved. This week now aims for 4 days.')).toBeOnTheScreen()
})

it('pauses from tomorrow for some days, says why one cannot, and cancels a pause', async () => {
  let current = rhythm()
  let refuse = true
  const api = mockApi({
    Rhythm: () => ({ data: { rhythm: current } }),
    PauseRhythm: (v) => {
      if (refuse) {
        refuse = false
        return ok('pauseRhythm', [{ __typename: 'UserError', message: 'These days are already paused.', code: 'CONFLICT' }])
      }
      current = rhythm({ pauses: [{ __typename: 'RhythmPause', id: PAUSE, ...(v.input as object), active: false }], pauseDaysLeft: 10 })
      return ok('pauseRhythm')
    },
    EndRhythmPause: () => {
      current = rhythm()
      return ok('endRhythmPause')
    },
  })
  await show()
  await fireEvent.press(await screen.findByRole('button', { name: 'Pause Rhythm' }))
  await fireEvent.press(screen.getByRole('button', { name: 'From tomorrow' }))
  await fireEvent.press(screen.getByRole('button', { name: 'One day more' }))
  expect(screen.getByText('4 days: Oct 16 to Oct 19')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Illness' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Pause' }))
  expect(await screen.findByText('These days are already paused.')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Pause' }))
  await waitFor(() => expect(api.calls.filter((c) => c.op === 'PauseRhythm').at(-1)?.variables).toEqual({ input: { from: '2026-10-16', to: '2026-10-19', reason: 'ILLNESS' } }))
  expect(await screen.findByText('Illness: Oct 16 to Oct 19')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel the pause' }))
  await waitFor(() => expect(api.calls.find((c) => c.op === 'EndRhythmPause')?.variables).toEqual({ input: { id: PAUSE } }))
  expect(await screen.findByText('No pauses.')).toBeOnTheScreen()
})
