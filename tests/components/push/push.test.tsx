import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'
import { forgetPushToken, PushSetup, registerForPush } from '@/features/push/push'
import { TurnOnPush } from '@/features/push/TurnOnPush'
import { NotificationSettingsScreen } from '@/features/settings/NotificationSettingsScreen'
import { createApolloClient } from '@/lib/apollo'
import { mockApi } from '../../support/api'
import { renderInApp } from '../../support/render'

/** Push and its settings on the phone (lvn-backend ADR-0021, ADR-0050). */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }))

const mocked = Notifications as jest.Mocked<typeof Notifications>
const inApollo = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)
const TOKEN = 'fcm-token-0123456789-abcdefghijklmnopqrstuvwxyz'

beforeEach(() => jest.clearAllMocks())

it('asks once signed in, registers the native token, and forgets it on sign-out', async () => {
  mocked.getPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: true } as never)
  mocked.requestPermissionsAsync.mockResolvedValueOnce({ granted: true } as never)
  mocked.getDevicePushTokenAsync.mockResolvedValueOnce({ type: 'android', data: TOKEN } as never)
  const api = mockApi({
    RegisterDevice: () => ({ data: { registerDevice: { __typename: 'OkPayload', ok: true, userErrors: [] } } }),
    UnregisterDevice: () => ({ data: { unregisterDevice: { __typename: 'OkPayload', ok: true } } }),
  })
  const client = createApolloClient()
  expect(await registerForPush(client, { ask: true })).toBe(true)
  expect(api.calls.find((c) => c.op === 'RegisterDevice')?.variables).toEqual({ token: TOKEN, platform: 'ANDROID' })
  await forgetPushToken(client)
  expect(api.calls.find((c) => c.op === 'UnregisterDevice')?.variables).toEqual({ token: TOKEN })
})

it('does nothing without permission or without a Firebase token', async () => {
  const api = mockApi({})
  const client = createApolloClient()
  expect(await registerForPush(client, { ask: true })).toBe(false)
  mocked.getPermissionsAsync.mockResolvedValueOnce({ granted: true } as never)
  mocked.getDevicePushTokenAsync.mockRejectedValueOnce(new Error('Default FirebaseApp is not initialized'))
  expect(await registerForPush(client, { ask: true })).toBe(false)
  // Without being asked to, it never asks: the prompt belongs to the person's own "Turn on" (ADR-0050).
  mocked.getPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: true } as never)
  expect(await registerForPush(client, { ask: false })).toBe(false)
  expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled()
  expect(api.calls.filter((c) => c.op === 'RegisterDevice')).toEqual([])
})

it('a tapped notification opens its in-app path, never anything else', async () => {
  mockApi({})
  const tap = (path: unknown) => ({ notification: { request: { content: { data: { path } } } } })
  mocked.getLastNotificationResponseAsync.mockResolvedValueOnce(tap('/groups/g1/doubts/d1') as never)
  await inApollo(<PushSetup />)
  await waitFor(() => expect(router.push).toHaveBeenCalledWith('/groups/g1/doubts/d1'))
  const listener = mocked.addNotificationResponseReceivedListener.mock.calls[0]![0]
  listener(tap('https://evil.example/x') as never)
  listener(tap('//evil.example/x') as never)
  expect(router.push).toHaveBeenCalledTimes(1)
})

it('the settings screen switches a kind off and turns the weekly email off', async () => {
  const settings = (over: Record<string, unknown> = {}) => ({
    __typename: 'NotificationSettings', quietStart: '22:00', quietEnd: '07:00', timeZone: 'Asia/Kolkata', weeklyDigest: true, pushAvailable: true, devices: 1,
    categories: [{ __typename: 'CategoryPreference', category: 'FOLLOW', push: true, email: null }, { __typename: 'CategoryPreference', category: 'CLASSROOM_POST', push: true, email: true }],
    ...over,
  })
  const api = mockApi({
    NotificationSettings: () => ({ data: { notificationSettings: settings() } }),
    UpdateNotificationSettings: () => ({ data: { updateNotificationSettings: { __typename: 'NotificationSettingsPayload', settings: settings(), userErrors: [] } } }),
  })
  await inApollo(<NotificationSettingsScreen />)
  await fireEvent(await screen.findByLabelText('Phone notifications for New followers'), 'valueChange', false)
  await fireEvent(screen.getByLabelText('Emails for Class announcements'), 'valueChange', false)
  await fireEvent(screen.getByLabelText('Weekly email'), 'valueChange', false)
  expect(screen.queryByLabelText('Emails for New followers')).toBeNull()
  await waitFor(() =>
    expect(api.calls.filter((c) => c.op === 'UpdateNotificationSettings').map((c) => c.variables.input)).toEqual([{ categories: [{ category: 'FOLLOW', push: false }] }, { categories: [{ category: 'CLASSROOM_POST', email: false }] }, { weeklyDigest: false }]),
  )
})

it('the Turn on offer asks for permission when pressed, then goes away', async () => {
  mocked.getPermissionsAsync
    .mockResolvedValueOnce({ granted: false, canAskAgain: true } as never)
    .mockResolvedValueOnce({ granted: false, canAskAgain: true } as never)
    .mockResolvedValueOnce({ granted: true, canAskAgain: true } as never)
  mocked.requestPermissionsAsync.mockResolvedValueOnce({ granted: true } as never)
  mocked.getDevicePushTokenAsync.mockResolvedValueOnce({ type: 'android', data: TOKEN } as never)
  const api = mockApi({ RegisterDevice: () => ({ data: { registerDevice: { __typename: 'OkPayload', ok: true, userErrors: [] } } }) })
  await inApollo(<TurnOnPush />)
  await fireEvent.press(await screen.findByText('Turn on'))
  await waitFor(() => expect(screen.queryByText('Turn on')).toBeNull())
  expect(mocked.requestPermissionsAsync).toHaveBeenCalledTimes(1)
  expect(api.calls.find((c) => c.op === 'RegisterDevice')?.variables).toEqual({ token: TOKEN, platform: 'ANDROID' })
})

it('a token is sent once: a repeat, or the token event, does not register it again', async () => {
  mocked.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true } as never)
  mocked.getDevicePushTokenAsync.mockResolvedValue({ type: 'android', data: `${TOKEN}-again` } as never)
  const api = mockApi({ RegisterDevice: () => ({ data: { registerDevice: { __typename: 'OkPayload', ok: true, userErrors: [] } } }) })
  await inApollo(<PushSetup />)
  await waitFor(() => expect(api.calls.filter((c) => c.op === 'RegisterDevice')).toHaveLength(1))
  const onToken = mocked.addPushTokenListener.mock.calls[0]![0]
  onToken({ type: 'android', data: `${TOKEN}-again` } as never)
  expect(await registerForPush(createApolloClient(), { ask: false })).toBe(true)
  await new Promise((r) => setTimeout(r, 20))
  expect(api.calls.filter((c) => c.op === 'RegisterDevice')).toHaveLength(1)
  // A new token from the event is registered, without asking FCM for it again.
  onToken({ type: 'android', data: `${TOKEN}-rotated` } as never)
  await waitFor(() => expect(api.calls.filter((c) => c.op === 'RegisterDevice').map((c) => c.variables.token)).toEqual([`${TOKEN}-again`, `${TOKEN}-rotated`]))
  expect(mocked.getDevicePushTokenAsync).toHaveBeenCalledTimes(2)
  // Back to the defaults of tests/support/setup.ts.
  mocked.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false } as never)
  mocked.getDevicePushTokenAsync.mockResolvedValue({ type: 'android', data: '' } as never)
})
