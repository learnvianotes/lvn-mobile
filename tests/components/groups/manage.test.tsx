import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen, within } from '@testing-library/react-native'
import { router } from 'expo-router'
import { Alert } from 'react-native'
import { GroupScreen } from '@/features/groups/GroupScreen'
import { NewGroupScreen } from '@/features/groups/NewGroupScreen'
import { createApolloClient } from '@/lib/apollo'
import { mockApi } from '../../support/api'
import { renderInApp } from '../../support/render'

/** Running a group from the phone (lvn-backend ADR-0045, ADR-0048): starting one, roles, muting, hand-over, settings. */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }))
jest.mock('@/features/notes/store/db', () => ({ listNotes: jest.fn(async () => []), subscribe: () => () => {} }))

const GROUP = '01920000-0000-7000-8000-0000000a0001'
const can = (over: Record<string, boolean> = {}) => ({ __typename: 'GroupActions', join: false, requestJoin: false, post: true, moderate: false, manage: false, delete: false, reviewRequests: false, leave: true, askDoubt: false, inviteMentor: false, acceptMentorInvite: false, ...over })
const group = (over: Record<string, unknown> = {}) => ({ __typename: 'Group', moderationWarning: null, id: GROUP, type: 'COMMUNITY', viewerMentorInviteId: null, name: 'Algorithms study', description: 'Weekly problems', privacy: 'PUBLIC', joinPolicy: 'APPROVAL', memberCount: 3, viewerRole: 'OWNER', createdAt: '2026-10-01T10:00:00.000Z', viewerRequestId: null, owner: { __typename: 'User', id: 'me', displayName: 'Meera Iyer' }, viewerCan: can(), ...over })
const person = (id: string, displayName: string, role: string, mutedUntil: string | null = null) => ({ __typename: 'GroupMember', role, joinedAt: '2026-10-01T10:00:00.000Z', mutedUntil, user: { __typename: 'User', id, displayName, handle: displayName.split(' ')[0]!.toLowerCase() } })
const members = (list: unknown[], viewerRole = 'OWNER') => ({ data: { group: { __typename: 'Group', id: GROUP, viewerRole, members: list, joinRequests: [] } } })
const empty = { data: { group: { __typename: 'Group', id: GROUP, posts: { __typename: 'GroupPostConnection', pinned: [], edges: [], pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: null } } } } }
const ok = (name: string, extra: Record<string, unknown> = {}) => ({ data: { [name]: { __typename: 'Payload', userErrors: [], ...extra } } })
const inApollo = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)
const confirmAll = () => jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.find((b) => b.style === 'destructive')?.onPress?.())

beforeEach(() => jest.clearAllMocks())

it('starts a project workspace that people join without approval', async () => {
  const api = mockApi({ CreateGroup: () => ({ data: { createGroup: { __typename: 'GroupPayload', group: group({ id: 'g9', type: 'PROJECT' }), userErrors: [] } } }) })
  await inApollo(<NewGroupScreen />)
  expect(screen.getByRole('button', { name: 'Create group' })).toBeDisabled()
  await fireEvent.changeText(screen.getByLabelText('Name'), '  Rover team ')
  await fireEvent.press(screen.getByRole('radio', { name: 'Project workspace' }))
  await fireEvent(screen.getByLabelText('Let people join without approval'), 'valueChange', true)
  await fireEvent.press(screen.getByRole('button', { name: 'Create group' }))
  await screen.findByRole('button', { name: 'Create group' })
  expect(api.calls.find((c) => c.op === 'CreateGroup')?.variables).toEqual({ input: { name: 'Rover team', description: null, type: 'PROJECT', privacy: 'PUBLIC', joinPolicy: 'OPEN' } })
  expect(router.replace).toHaveBeenCalledWith('/groups/g9')
})

it('a private group always asks for approval, and the API’s refusal is shown', async () => {
  const api = mockApi({ CreateGroup: () => ({ data: { createGroup: { __typename: 'GroupPayload', group: null, userErrors: [{ __typename: 'UserError', message: 'You have reached the number of groups your plan allows.', field: null }] } } }) })
  await inApollo(<NewGroupScreen />)
  await fireEvent.changeText(screen.getByLabelText('Name'), 'Quiet corner')
  await fireEvent(screen.getByLabelText('Let people join without approval'), 'valueChange', true)
  await fireEvent.press(screen.getByRole('radio', { name: 'Private' }))
  expect(screen.queryByLabelText('Let people join without approval')).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: 'Create group' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('You have reached the number of groups your plan allows.')
  expect(api.calls.find((c) => c.op === 'CreateGroup')?.variables).toMatchObject({ input: { privacy: 'PRIVATE', joinPolicy: 'APPROVAL' } })
  expect(router.replace).not.toHaveBeenCalled()
})

it('the owner gives roles below their own, mutes, hands the group over and removes, from each member’s sheet', async () => {
  confirmAll()
  let list = [person('me', 'Meera Iyer', 'OWNER'), person('u2', 'Ravi Kumar', 'MEMBER'), person('u3', 'Asha Rao', 'MODERATOR')]
  const api = mockApi({
    Group: () => ({ data: { group: group({ viewerCan: can({ manage: true, moderate: true, delete: true, reviewRequests: true, leave: false }) }) } }),
    GroupPosts: () => empty,
    GroupMembers: () => members(list),
    SetGroupRole: (v) => ((list = list.map((m) => (m.user.id === v.userId ? { ...m, role: String(v.role) } : m))), ok('setGroupRole', { group: group() })),
    MuteGroupMember: (v) => ((list = list.map((m) => (m.user.id === v.userId ? { ...m, mutedUntil: v.until as string | null } : m))), ok('muteGroupMember', { group: { __typename: 'Group', id: GROUP } })),
    RemoveGroupMember: (v) => ((list = list.filter((m) => m.user.id !== v.userId)), ok('removeGroupMember', { group: { __typename: 'Group', id: GROUP, memberCount: 2 } })),
  })
  await inApollo(<GroupScreen id={GROUP} />)
  await fireEvent.press(await screen.findByRole('tab', { name: 'Members' }))
  expect(await screen.findByText('Ravi Kumar')).toBeOnTheScreen()
  // Nobody manages themselves.
  expect(screen.queryByLabelText('Manage Meera Iyer')).toBeNull()

  await fireEvent.press(screen.getByLabelText('Manage Ravi Kumar'))
  expect(screen.getAllByRole('menuitem').map((m) => within(m).getByText(/./).props.children)).toEqual(['Make admin', 'Make moderator', 'Hand the group to Ravi Kumar', 'Mute for a day', 'Remove from the group'])
  await fireEvent.press(screen.getByRole('menuitem', { name: 'Make moderator' }))
  expect(await screen.findByText('Ravi Kumar is now moderator.')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'SetGroupRole')?.variables).toEqual({ groupId: GROUP, userId: 'u2', role: 'MODERATOR' })

  await fireEvent.press(screen.getByLabelText('Manage Ravi Kumar'))
  await fireEvent.press(screen.getByRole('menuitem', { name: 'Mute for a day' }))
  expect(await screen.findByText('Moderator · muted')).toBeOnTheScreen()
  const until = new Date(String(api.calls.find((c) => c.op === 'MuteGroupMember')?.variables.until)).getTime()
  expect(until - Date.now()).toBeGreaterThan(86_000_000)

  await fireEvent.press(screen.getByLabelText('Manage Ravi Kumar'))
  await fireEvent.press(screen.getByRole('menuitem', { name: 'Unmute' }))
  await screen.findByText('Ravi Kumar can post again.')
  expect(api.calls.filter((c) => c.op === 'MuteGroupMember').at(-1)?.variables.until).toBeNull()

  await fireEvent.press(screen.getByLabelText('Manage Asha Rao'))
  await fireEvent.press(screen.getByRole('menuitem', { name: 'Hand the group to Asha Rao' }))
  expect(Alert.alert).toHaveBeenCalledWith('Hand Algorithms study to Asha Rao?', 'You stay on as an admin.', expect.anything())
  await screen.findByText('Asha Rao owns the group now. You stay on as an admin.')
  expect(api.calls.filter((c) => c.op === 'SetGroupRole').at(-1)?.variables).toEqual({ groupId: GROUP, userId: 'u3', role: 'OWNER' })

  await fireEvent.press(screen.getByLabelText('Manage Ravi Kumar'))
  await fireEvent.press(screen.getByRole('menuitem', { name: 'Remove from the group' }))
  expect(await screen.findByText('Ravi Kumar was removed.')).toBeOnTheScreen()
  expect(screen.queryByLabelText('Manage Ravi Kumar')).toBeNull()
})

it('a mentor has no role to change and is not handed the workspace; the owner can still remove them (ADR-0048)', async () => {
  mockApi({
    Group: () => ({ data: { group: group({ type: 'PROJECT', viewerCan: can({ manage: true, moderate: true, delete: true, leave: false }) }) } }),
    GroupPosts: () => empty,
    Workspace: () => ({ data: { group: { __typename: 'Group', id: GROUP, repository: null, showcase: null } } }),
    GroupMembers: () => members([person('me', 'Meera Iyer', 'OWNER'), person('t1', 'Dev Patel', 'MENTOR')]),
  })
  await inApollo(<GroupScreen id={GROUP} />)
  await fireEvent.press(await screen.findByRole('tab', { name: 'Members' }))
  await fireEvent.press(await screen.findByLabelText('Manage Dev Patel'))
  expect(screen.getAllByRole('menuitem').map((m) => within(m).getByText(/./).props.children)).toEqual(['Mute for a day', 'Remove from the group'])
})

it('a moderator only mutes, and only those below them', async () => {
  mockApi({
    Group: () => ({ data: { group: group({ viewerRole: 'MODERATOR', viewerCan: can({ moderate: true }) }) } }),
    GroupPosts: () => empty,
    GroupMembers: () => members([person('o', 'Meera Iyer', 'OWNER'), person('a', 'Asha Rao', 'ADMIN'), person('m2', 'Dev Patel', 'MODERATOR'), person('u2', 'Ravi Kumar', 'MEMBER')], 'MODERATOR'),
  })
  await inApollo(<GroupScreen id={GROUP} />)
  expect(screen.queryByRole('tab', { name: 'Settings' })).toBeNull()
  await fireEvent.press(await screen.findByRole('tab', { name: 'Members' }))
  await screen.findByText('Ravi Kumar')
  expect(screen.queryByLabelText('Manage Meera Iyer')).toBeNull()
  expect(screen.queryByLabelText('Manage Asha Rao')).toBeNull()
  expect(screen.queryByLabelText('Manage Dev Patel')).toBeNull()
  await fireEvent.press(screen.getByLabelText('Manage Ravi Kumar'))
  expect(screen.getAllByRole('menuitem').map((m) => within(m).getByText(/./).props.children)).toEqual(['Mute for a day'])
})

it('an admin changes the settings and the owner deletes the group', async () => {
  confirmAll()
  const api = mockApi({
    Group: () => ({ data: { group: group({ viewerCan: can({ manage: true, delete: true, leave: false }) }) } }),
    GroupPosts: () => empty,
    UpdateGroup: () => ok('updateGroup', { group: group() }),
    DeleteGroup: () => ok('deleteGroup', { ok: true }),
  })
  await inApollo(<GroupScreen id={GROUP} />)
  await fireEvent.press(await screen.findByRole('tab', { name: 'Settings' }))
  await fireEvent.changeText(screen.getByLabelText('Name'), 'Algorithms circle')
  await fireEvent.press(screen.getByRole('radio', { name: 'Private' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByText('Saved.')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'UpdateGroup')?.variables).toEqual({ input: { groupId: GROUP, name: 'Algorithms circle', description: 'Weekly problems', privacy: 'PRIVATE', joinPolicy: 'APPROVAL' } })
  await fireEvent.press(screen.getByRole('button', { name: 'Delete group' }))
  expect(Alert.alert).toHaveBeenCalledWith('Delete Algorithms study for everyone?', 'This cannot be undone.', expect.anything())
  await screen.findByRole('tab', { name: 'Settings' })
  expect(api.ops()).toContain('DeleteGroup')
  expect(router.replace).toHaveBeenCalledWith('/community')
})
