import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native'
import { AccountScreen } from '@/features/auth/AccountScreen'
import { GroupScreen } from '@/features/groups/GroupScreen'
import { PlatformQueueScreen } from '@/features/moderation/PlatformQueueScreen'
import { createApolloClient } from '@/lib/apollo'
import { mockApi, viewer } from '../../support/api'
import { renderInApp } from '../../support/render'

/** Account standing on the phone (lvn-backend ADR-0053): a suspension and its appeal, warnings, removed groups, and the queue. */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() }, Link: ({ children }: { children: React.ReactNode }) => children }))
jest.mock('@/features/notes/store/db', () => ({ listNotes: jest.fn(async () => []), subscribe: () => () => {} }))

const ME = '01920000-0000-7000-8000-00000000aaaa'
const GROUP = '01920000-0000-7000-8000-0000000a0001'
const ok = (name: string) => ({ data: { [name]: { __typename: 'OkPayload', ok: true, userErrors: [] } } })
const standing = (over: Record<string, unknown> = {}) => ({ data: { myStanding: { __typename: 'AccountStanding', suspendedUntil: null, suspensionReason: null, canAppeal: false, warnings: [], ...over } } })
const inApollo = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)

beforeEach(() => jest.clearAllMocks())

it('a suspended person reads until when and why, what still works, and appeals once; warnings are listed', async () => {
  let appealed = false
  const api = mockApi({
    Viewer: () => ({ data: { viewer: viewer() } }),
    MyDataExports: () => ({ data: { myDataExports: [] } }),
    MyStanding: () => standing({ suspendedUntil: new Date(Date.now() + 7 * 86_400_000).toISOString(), suspensionReason: 'Posting the same link everywhere.', canAppeal: !appealed, warnings: [{ __typename: 'AccountWarning', reason: 'Keep comments about the work.', at: new Date().toISOString() }] }),
    AppealModeration: () => ((appealed = true), ok('appealModeration')),
  })
  await inApollo(<AccountScreen />)
  expect(await screen.findByText(/^Your account is suspended until /)).toBeOnTheScreen()
  expect(screen.getByText('Posting the same link everywhere.')).toBeOnTheScreen()
  expect(screen.getByText(/nothing you do reaches other people/)).toBeOnTheScreen()
  expect(screen.getByText('A warning from the moderators')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Appeal' }))
  await fireEvent.changeText(screen.getByLabelText('Tell the moderators why'), 'It was a class announcement.')
  await fireEvent.press(screen.getByRole('button', { name: 'Send appeal' }))
  expect(await screen.findByText('You have used your one appeal.')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'AppealModeration')?.variables).toEqual({ input: { entityType: 'USER', entityId: viewer().id, message: 'It was a class announcement.' } })
})

it('an account in good standing shows nothing about it', async () => {
  mockApi({ Viewer: () => ({ data: { viewer: viewer() } }), MyDataExports: () => ({ data: { myDataExports: [] } }), MyStanding: () => standing() })
  await inApollo(<AccountScreen />)
  await screen.findByText('Asha Rao')
  expect(screen.queryByText(/suspended/)).toBeNull()
  expect(screen.queryByText(/warning/)).toBeNull()
})

it('the owner of a removed group reads why where it was and appeals; anyone else finds nothing', async () => {
  let mine = true
  let appealed = false
  const api = mockApi({
    Group: () => ({ data: { group: null } }),
    RemovedGroup: () => ({ data: { removedGroup: mine ? { __typename: 'RemovedGroup', id: GROUP, name: 'Exam leaks', reason: 'Shares exam papers before the exam.', removedAt: new Date().toISOString(), canAppeal: !appealed } : null } }),
    AppealModeration: () => ((appealed = true), ok('appealModeration')),
  })
  await inApollo(<GroupScreen id={GROUP} />)
  expect(await screen.findByRole('header', { name: 'Moderators removed Exam leaks' })).toBeOnTheScreen()
  expect(screen.getByText('Shares exam papers before the exam.')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Appeal' }))
  await fireEvent.changeText(screen.getByLabelText('Tell the moderators why'), 'Last year’s papers.')
  await fireEvent.press(screen.getByRole('button', { name: 'Send appeal' }))
  expect(await screen.findByText('You have used your one appeal.')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'AppealModeration')?.variables).toEqual({ input: { entityType: 'GROUP', entityId: GROUP, message: 'Last year’s papers.' } })

  mine = false
  await inApollo(<GroupScreen id={GROUP} />)
  expect(await screen.findByText('This group is not available.')).toBeOnTheScreen()
})

it('platform admins suspend for some days, lift a suspension after its appeal, and put a removed group back', async () => {
  const at = new Date().toISOString()
  const base = { __typename: 'ModerationCase', scope: 'PLATFORM', scopeId: null, openedAt: at, note: null, group: null, content: null, removedGroup: null, suspendedUntil: null, appeal: null, reports: [] }
  const cases = [
    { ...base, entityType: 'USER', entityId: 'u2', user: { __typename: 'User', id: 'u2', displayName: 'Ravi Kumar', handle: 'ravi' } },
    { ...base, entityType: 'USER', entityId: 'u3', user: { __typename: 'User', id: 'u3', displayName: 'Dev Patel', handle: 'dev' }, suspendedUntil: new Date(Date.now() + 5 * 86_400_000).toISOString(), appeal: { __typename: 'ModerationAppeal', message: 'It was a class announcement.', createdAt: at } },
    { ...base, entityType: 'GROUP', entityId: GROUP, user: null, removedGroup: { __typename: 'RemovedGroup', id: GROUP, name: 'Exam leaks', reason: 'Shares exam papers.', removedAt: at }, appeal: { __typename: 'ModerationAppeal', message: 'Old papers.', createdAt: at } },
  ]
  const api = mockApi({
    Viewer: () => ({ data: { viewer: viewer({ globalRole: 'PLATFORM_ADMIN' }) } }),
    ModerationQueue: () => ({ data: { moderationQueue: { __typename: 'ModerationCaseConnection', edges: cases.map((node, i) => ({ __typename: 'ModerationCaseEdge', cursor: String(i), node })), pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: null } } } }),
    ModerateContent: () => ok('moderateContent'),
  })
  await inApollo(<PlatformQueueScreen />)
  const cards = await screen.findAllByLabelText('Account case')
  const ravi = cards[0]!
  const dev = cards[1]!
  expect(within(ravi).getByText('Ravi Kumar (@ravi)')).toBeOnTheScreen()
  await fireEvent.press(within(ravi).getByRole('radio', { name: '30 days' }))
  await fireEvent.press(within(ravi).getByText('Suspend'))
  expect(within(ravi).getByText('Write a reason first: the author is told.')).toBeOnTheScreen()
  await fireEvent.changeText(within(ravi).getByLabelText('Reason (the author sees it)'), 'Posting the same link everywhere.')
  await fireEvent.press(within(ravi).getByText('Suspend'))
  await waitFor(() => expect(api.calls.find((c) => c.op === 'ModerateContent')?.variables).toEqual({ input: { entityType: 'USER', entityId: 'u2', action: 'SUSPEND', reason: 'Posting the same link everywhere.', suspendDays: 30 } }))

  expect(within(dev).getByText(/^Suspended until /)).toBeOnTheScreen()
  expect(within(dev).queryByLabelText('Suspend for')).toBeNull()
  await fireEvent.press(within(dev).getByText('Lift the suspension'))
  await waitFor(() => expect(api.calls.filter((c) => c.op === 'ModerateContent').at(-1)?.variables).toEqual({ input: { entityType: 'USER', entityId: 'u3', action: 'APPROVE', reason: null } }))

  const group = screen.getByLabelText('Group case')
  expect(within(group).getByText('Exam leaks')).toBeOnTheScreen()
  expect(within(group).getByText('Removed: Shares exam papers.')).toBeOnTheScreen()
  expect(within(group).queryByText('Remove')).toBeNull()
  await fireEvent.press(within(group).getByText('Put it back'))
  await waitFor(() => expect(api.calls.filter((c) => c.op === 'ModerateContent').at(-1)?.variables).toEqual({ input: { entityType: 'GROUP', entityId: GROUP, action: 'APPROVE', reason: null } }))
})
