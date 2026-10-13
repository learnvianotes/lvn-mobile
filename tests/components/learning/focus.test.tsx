import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { ClassPerformance, ClassRhythm } from '@/features/classes/ClassInsights'
import { BuddiesCard, FocusCard } from '@/features/learning/FocusCard'
import { createApolloClient } from '@/lib/apollo'
import { mockApi } from '../../support/api'
import { renderInApp } from '../../support/render'

/** Focus mode, Rhythm buddies, sharing, and a class's Rhythm and performance on the phone (lvn-backend ADR-0072). */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }))

const SESSION = '01920000-0000-7000-8000-00000000f001'
const CLASS = '01920000-0000-7000-8000-00000000c1a5'
const user = (id: string, displayName: string) => ({ __typename: 'User', id, displayName, handle: 'h' })
const session = (over: Record<string, unknown> = {}) => ({ __typename: 'FocusSession', id: SESSION, topicKey: null, plannedMinutes: 25, breakMinutes: 5, meetUrl: null, startedAt: new Date(Date.now() - 60_000).toISOString(), endedAt: null, focusedSeconds: 0, ...over })
const ok = (name: string, userErrors: unknown[] = []) => ({ data: { [name]: { __typename: 'OkPayload', ok: !userErrors.length, userErrors } } })
const inApp = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)

it('starts a focus session, shows the time left, and ends it', async () => {
  let open: ReturnType<typeof session> | null = null
  const api = mockApi({
    FocusSession: () => ({ data: { focusSession: open } }),
    StartFocusSession: () => {
      open = session()
      return { data: { startFocusSession: { __typename: 'FocusSessionPayload', session: open, userErrors: [] } } }
    },
    EndFocusSession: () => {
      open = null
      return { data: { endFocusSession: { __typename: 'FocusSessionPayload', session: session({ endedAt: new Date().toISOString(), focusedSeconds: 660 }), userErrors: [] } } }
    },
    Rhythm: () => new Error('not here'),
  })
  await inApp(<FocusCard />)
  await fireEvent.press(await screen.findByRole('button', { name: '45 min' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Start focusing' }))
  await waitFor(() => expect(api.calls.find((c) => c.op === 'StartFocusSession')?.variables).toEqual({ input: { minutes: 45, breakMinutes: 5, meetUrl: null } }))
  expect(await screen.findByLabelText(/^2[34]:\d\d left$/)).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'End the session' }))
  expect(await screen.findByText('11 minutes counted.')).toBeOnTheScreen()
})

it('shows buddies studying now, answers an invite, says why an invite cannot go, and turns sharing on', async () => {
  let list = {
    __typename: 'RhythmBuddies',
    buddies: [{ __typename: 'RhythmBuddy', id: '01920000-0000-7000-8000-0000000b0001', user: user('01920000-0000-7000-8000-0000000000aa', 'Ravi Kumar'), studyingNow: true, studyingSince: new Date().toISOString(), topicTitle: 'Paging', meetUrl: 'https://meet.google.com/abc-defg-hij', countedDays: 2, target: 4, met: false }],
    invites: [{ __typename: 'RhythmBuddyInvite', id: '01920000-0000-7000-8000-0000000b0002', at: new Date().toISOString(), user: user('01920000-0000-7000-8000-0000000000bb', 'Meena Shah') }],
    sent: [],
  }
  const api = mockApi({
    RhythmBuddies: () => ({ data: { rhythmBuddies: list } }),
    AnswerRhythmBuddy: () => {
      list = { ...list, invites: [] }
      return ok('answerRhythmBuddy')
    },
    InviteRhythmBuddy: () => ok('inviteRhythmBuddy', [{ __typename: 'UserError', message: 'Follow someone, or connect with them, before asking them to be your buddy.', code: 'VALIDATION' }]),
    SetRhythmSharing: () => ok('setRhythmSharing'),
    Rhythm: () => new Error('not here'),
  })
  await inApp(<BuddiesCard shared={false} />)
  expect(await screen.findByText('Ravi Kumar · Studying now')).toBeOnTheScreen()
  expect(screen.getByText('On Paging · 2 of 4 days this week')).toBeOnTheScreen()
  expect(screen.getByRole('link', { name: 'Join' })).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Accept' }))
  await waitFor(() => expect(api.calls.find((c) => c.op === 'AnswerRhythmBuddy')?.variables).toEqual({ input: { id: '01920000-0000-7000-8000-0000000b0002', accept: true } }))
  await fireEvent.changeText(screen.getByLabelText('Ask someone by their handle'), 'stranger')
  await fireEvent.press(screen.getByRole('button', { name: 'Ask' }))
  expect(await screen.findByText('Follow someone, or connect with them, before asking them to be your buddy.')).toBeOnTheScreen()
  await fireEvent(screen.getByLabelText('Share my Rhythm with my classes'), 'valueChange', true)
  await waitFor(() => expect(api.calls.find((c) => c.op === 'SetRhythmSharing')?.variables).toEqual({ input: { share: true } }))
})

it('shows a class its Rhythm this week, and staff its performance and hard topics', async () => {
  mockApi({
    ClassroomRhythmRing: () => ({ data: { classroom: { __typename: 'Classroom', id: CLASS, rhythmRing: { __typename: 'ClassroomRhythm', students: 2, metCount: 1, countedDays: 5, targetDays: 8, people: [{ __typename: 'ClassroomRhythmPerson', name: 'Kiran', countedDays: 4, target: 4, met: true, user: { __typename: 'User', id: '01920000-0000-7000-8000-0000000000dd' } }] } } } }),
    ClassroomPerformance: () => ({
      data: {
        classroom: {
          __typename: 'Classroom', id: CLASS,
          performance: {
            __typename: 'ClassPerformance', quizzes: 2,
            students: [{ __typename: 'ClassStudentPerformance', name: 'Kiran Das', submitted: 2, average: 0.75, user: { __typename: 'User', id: '01920000-0000-7000-8000-0000000000dd' }, scores: [] }],
            topics: [{ __typename: 'ClassTopicPerformance', key: 'topic:x', title: 'Paging', accuracy: 0.25, answers: 8, hard: true }],
          },
        },
      },
    }),
  })
  await inApp(<><ClassRhythm classroomId={CLASS} /><ClassPerformance classroomId={CLASS} /></>)
  expect(await screen.findByText('1 of 2 students met their week · 5 of 8 days counted')).toBeOnTheScreen()
  expect(screen.getByText('Kiran')).toBeOnTheScreen()
  expect(await screen.findByLabelText('Kiran Das: 2 of 2 quizzes, average 75%')).toBeOnTheScreen()
  expect(screen.getByText('Paging · Hard')).toBeOnTheScreen()
  expect(screen.getByText('25% right of 8')).toBeOnTheScreen()
})
