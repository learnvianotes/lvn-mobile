import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen } from '@testing-library/react-native'
import { ContestScreen } from '@/features/contests/ContestScreen'
import { createApolloClient } from '@/lib/apollo'
import { mockApi } from '../../support/api'
import { renderInApp } from '../../support/render'

/**
 * A weekly contest on the phone (lvn-backend ADR-0082): started, answered against the clock, submitted, and every
 * answer explained after with the person's best and, for an adult who asked, a band.
 */
const ID = '01920000-0000-7000-8000-00000000c0a1'
const A = '01920000-0000-7000-8000-00000000c0b1'
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }, useLocalSearchParams: () => ({ id: '01920000-0000-7000-8000-00000000c0a1' }) }))

const inApp = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)
const base = { __typename: 'Contest', id: ID, title: 'DSA Battle #12', subjectTitle: 'Data Structures', opensAt: new Date(Date.now() - 3_600_000).toISOString(), closesAt: new Date(Date.now() + 86_400_000).toISOString(), minutes: 20, questionCount: 1, state: 'OPEN', participantsMilestone: null }
const attempt = (finished: boolean, mine: string | null) => ({
  __typename: 'ContestAttempt', id: A, startedAt: new Date().toISOString(), deadline: new Date(Date.now() + 19 * 60_000).toISOString(), submittedAt: finished ? new Date().toISOString() : null, finished,
  score: finished ? 1 : null, total: 1, personalBest: finished ? 100 : null, band: finished ? 'TOP_10' : null,
  questions: [{ __typename: 'ContestAttemptQuestion', id: '01920000-0000-7000-8000-00000000c0d1', prompt: 'Heap insert?', choices: [{ __typename: 'ContestChoice', id: 'c2', text: 'O(n)' }, { __typename: 'ContestChoice', id: 'c1', text: 'O(log n)' }], myChoiceId: mine, correctChoiceId: finished ? 'c1' : null, explanation: finished ? 'Sift-up walks one path.' : null }],
})

it('starts, answers, submits, and explains every answer', async () => {
  let state: 'none' | 'started' | 'done' = 'none'
  let mine: string | null = null
  const api = mockApi({
    Contest: () => ({ data: { contest: { ...base, viewerAttempt: state === 'none' ? null : attempt(state === 'done', mine) }, contestSettings: { __typename: 'ContestSettings', showBands: true, canShowBands: true } } }),
    StartContest: () => ((state = 'started'), { data: { startContest: { __typename: 'ContestPayload', contest: { ...base, viewerAttempt: attempt(false, null) }, userErrors: [] } } }),
    AnswerContestQuestion: (v) => ((mine = (v as { input: { choiceId: string } }).input.choiceId), { data: { answerContestQuestion: { __typename: 'ContestPayload', contest: { __typename: 'Contest', id: ID, viewerAttempt: { __typename: 'ContestAttempt', id: A, questions: [] } }, userErrors: [] } } }),
    SubmitContest: () => ((state = 'done'), { data: { submitContest: { __typename: 'ContestPayload', contest: { ...base, viewerAttempt: attempt(true, mine) }, userErrors: [] } } }),
  })
  await inApp(<ContestScreen />)
  await fireEvent.press(await screen.findByRole('button', { name: 'Start' }))
  expect(await screen.findByText('0 of 1 answered')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('radio', { name: 'O(log n)' }))
  expect(api.calls.find((c) => c.op === 'AnswerContestQuestion')?.variables).toEqual({ input: { attemptId: A, questionId: '01920000-0000-7000-8000-00000000c0d1', choiceId: 'c1' } })
  await fireEvent.press(screen.getByRole('button', { name: 'Submit' }))
  expect(await screen.findByText('1 of 1')).toBeOnTheScreen()
  expect(screen.getByText('Your best on Data Structures: 100%')).toBeOnTheScreen()
  expect(screen.getByText('You’re in the top 10% of adults who took it.')).toBeOnTheScreen()
  expect(screen.getByText('Sift-up walks one path.')).toBeOnTheScreen()
  expect(screen.getByLabelText('O(log n), right answer, your answer')).toBeOnTheScreen()
})
