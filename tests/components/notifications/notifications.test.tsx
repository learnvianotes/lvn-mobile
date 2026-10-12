import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import { HomeHeader } from '@/features/home/HomeHeader'
import { NotificationsScreen } from '@/features/notifications/NotificationsScreen'
import { createApolloClient } from '@/lib/apollo'
import { mockApi } from '../../support/api'
import { renderInApp } from '../../support/render'

/** Notifications on the phone (lvn-backend ADR-0042): the bell's count, the list in words, marking read. */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }))
// No live socket in tests: the module is replaced by one that never fires.
jest.mock('@/features/notifications/live', () => ({ useLive: jest.fn(), subscribeLive: jest.fn(() => () => {}) }))

const NOTE = '01920000-0000-7000-8000-00000000a001'
const node = (n: number, over: object) => ({ __typename: 'Notification', id: `01920000-0000-7000-8000-0000000f000${n}`, path: '/profile', data: null, readAt: null, createdAt: new Date(Date.now() - n * 300_000).toISOString(), actor: null, note: null, group: null, classroom: null, ...over })
const LIST = [
  node(1, { category: 'SHARE', path: `/notes/${NOTE}`, actor: { __typename: 'User', id: 'u1', displayName: 'Meera Iyer' }, note: { __typename: 'Note', id: NOTE, title: 'Binary heaps' } }),
  node(2, { category: 'DATA_EXPORT', readAt: new Date().toISOString() }),
]
const page = (unread: number) => ({ data: { notifications: { __typename: 'NotificationConnection', edges: LIST.map((n) => ({ __typename: 'NotificationEdge', node: n })), pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: null } }, unreadNotificationCount: unread } })
const marked = (left: number) => ({ data: { markNotificationsRead: { __typename: 'MarkNotificationsReadPayload', unreadCount: left, userErrors: [] } } })
const inApollo = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)

beforeEach(() => jest.clearAllMocks())

it('the home bell shows the unread count and opens the notifications', async () => {
  mockApi({ UnreadNotificationCount: () => ({ data: { unreadNotificationCount: 3 } }) })
  await inApollo(<HomeHeader />)
  await fireEvent.press(await screen.findByLabelText('Notifications, 3 unread'))
  expect(router.push).toHaveBeenCalledWith('/notifications')
})

it('lists notifications in words; opening one marks it read and goes where it points', async () => {
  const api = mockApi({ Notifications: () => page(1), MarkNotificationsRead: () => marked(0) })
  await inApollo(<NotificationsScreen />)
  expect(await screen.findByText('Meera Iyer shared “Binary heaps” with you')).toBeOnTheScreen()
  expect(screen.getByText('Your data export is ready to download')).toBeOnTheScreen()
  await fireEvent.press(screen.getByLabelText('Unread: Meera Iyer shared “Binary heaps” with you'))
  expect(router.push).toHaveBeenCalledWith(`/notes/${NOTE}`)
  await waitFor(() => expect(api.calls.find((c) => c.op === 'MarkNotificationsRead')?.variables).toEqual({ input: { ids: [LIST[0]!.id] } }))
})

it('marks everything read at once', async () => {
  const api = mockApi({ Notifications: () => page(1), MarkNotificationsRead: () => marked(0) })
  await inApollo(<NotificationsScreen />)
  await fireEvent.press(await screen.findByText('Mark all as read'))
  await waitFor(() => expect(api.calls.find((c) => c.op === 'MarkNotificationsRead')?.variables).toEqual({ input: { all: true } }))
  await waitFor(() => expect(screen.queryByText('Mark all as read')).toBeNull())
})
