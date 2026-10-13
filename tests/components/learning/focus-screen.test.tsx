import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import { FocusScreen } from '@/features/learning/FocusScreen'
import { createApolloClient } from '@/lib/apollo'
import { mockApi } from '../../support/api'
import { renderInApp } from '../../support/render'

/**
 * Board A's focus screen (lvn-backend ADR-0072, ADR-0076): Start focuses for a Pomodoro, Pause ends the session (its
 * time counts) and Resume starts another for what was left, the breaks are timed on the phone, and Close leaves.
 */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true } }))
jest.mock('@/lib/haptics', () => ({ haptic: { tick: jest.fn(), press: jest.fn(), success: jest.fn() } }))

const SESSION = '01920000-0000-7000-8000-00000000f001'
const session = (over: Record<string, unknown> = {}) => ({ __typename: 'FocusSession', id: SESSION, topicKey: null, plannedMinutes: 25, breakMinutes: 5, meetUrl: null, startedAt: new Date(Date.now() - 60_000).toISOString(), endedAt: null, focusedSeconds: 0, ...over })
const inApp = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)

function api() {
  let open: ReturnType<typeof session> | null = null
  return mockApi({
    FocusSession: () => ({ data: { focusSession: open } }),
    StartFocusSession: (v) => {
      open = session({ plannedMinutes: (v.input as { minutes: number }).minutes })
      return { data: { startFocusSession: { __typename: 'FocusSessionPayload', session: open, userErrors: [] } } }
    },
    EndFocusSession: () => {
      open = null
      return { data: { endFocusSession: { __typename: 'FocusSessionPayload', session: session({ endedAt: new Date().toISOString(), focusedSeconds: 60 }), userErrors: [] } } }
    },
    Rhythm: () => new Error('not here'),
  })
}

beforeEach(() => jest.clearAllMocks())

it('starts a Pomodoro, pauses (the minute counts) and resumes for what was left', async () => {
  const calls = api().calls
  await inApp(<FocusScreen />)
  expect(await screen.findByLabelText('25:00 left')).toBeOnTheScreen()
  expect(screen.getByRole('tab', { name: 'Pomodoro' })).toBeSelected()
  await fireEvent.press(screen.getByRole('button', { name: 'Start' }))
  await waitFor(() => expect(calls.find((c) => c.op === 'StartFocusSession')?.variables).toEqual({ input: { minutes: 25, breakMinutes: 5 } }))
  expect(await screen.findByLabelText(/^24:\d\d left$/)).toBeOnTheScreen()
  expect(screen.getByText('Focusing')).toBeOnTheScreen()

  await fireEvent.press(screen.getByRole('button', { name: 'Pause' }))
  await waitFor(() => expect(calls.filter((c) => c.op === 'EndFocusSession')).toHaveLength(1))
  expect(await screen.findByText('Paused')).toBeOnTheScreen()
  expect(screen.getByText('1 minute counted.')).toBeOnTheScreen()

  await fireEvent.press(screen.getByRole('button', { name: 'Resume' }))
  await waitFor(() => expect(calls.filter((c) => c.op === 'StartFocusSession').at(-1)?.variables).toEqual({ input: { minutes: 24, breakMinutes: 5 } }))
})

it('a break is timed here, never sent; a running focus ends first so its time counts', async () => {
  const calls = api().calls
  await inApp(<FocusScreen />)
  await fireEvent.press(await screen.findByRole('tab', { name: 'Short Break' }))
  expect(await screen.findByLabelText(/^0[45]:\d\d left$/)).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Skip break' })).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('tab', { name: 'Long Break' }))
  expect(await screen.findByLabelText(/^1[45]:\d\d left$/)).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Skip break' }))
  expect(await screen.findByRole('button', { name: 'Start' })).toBeOnTheScreen()
  expect(calls.filter((c) => c.op === 'StartFocusSession' || c.op === 'EndFocusSession')).toHaveLength(0)

  await fireEvent.press(screen.getByRole('button', { name: 'Start' }))
  await screen.findByRole('button', { name: 'Pause' })
  await fireEvent.press(screen.getByRole('tab', { name: 'Short Break' }))
  await waitFor(() => expect(calls.filter((c) => c.op === 'EndFocusSession')).toHaveLength(1))
  expect(await screen.findByRole('button', { name: 'Skip break' })).toBeOnTheScreen()
})

it('closes', async () => {
  api()
  await inApp(<FocusScreen />)
  await fireEvent.press(await screen.findByRole('button', { name: 'Close focus mode' }))
  expect(router.back).toHaveBeenCalled()
})
