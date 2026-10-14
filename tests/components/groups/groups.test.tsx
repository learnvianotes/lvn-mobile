import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import { CommunityScreen } from '@/features/groups/CommunityScreen'
import { GroupScreen } from '@/features/groups/GroupScreen'
import { createApolloClient } from '@/lib/apollo'
import { mockApi } from '../../support/api'
import { renderInApp } from '../../support/render'

/** Groups on the phone (lvn-backend ADR-0045): the Community tab, asking to join, posts, sharing a note, requests. */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() }, useLocalSearchParams: () => ({}) }))
jest.mock('@/features/notes/store/db', () => ({ listNotes: jest.fn(async () => [{ id: 'n1', title: 'Binary heaps' }]), subscribe: () => () => {} }))

const GROUP = '01920000-0000-7000-8000-0000000a0001'
const can = (over: Record<string, boolean> = {}) => ({ __typename: 'GroupActions', join: false, requestJoin: false, post: false, moderate: false, manage: false, delete: false, reviewRequests: false, leave: false, askDoubt: false, inviteMentor: false, acceptMentorInvite: false, ...over })
const group = (over: Record<string, unknown> = {}) => ({ __typename: 'Group', moderationWarning: null, id: GROUP, type: 'COMMUNITY', viewerMentorInviteId: null, pictureUrl: null, name: 'Algorithms study', description: 'Weekly problems', privacy: 'PUBLIC', joinPolicy: 'APPROVAL', memberCount: 12, viewerRole: null, createdAt: '2026-10-01T10:00:00.000Z', viewerRequestId: null, owner: { __typename: 'User', id: 'o1', displayName: 'Meera Iyer' }, viewerCan: can(), ...over })
const card = (id: string, name: string, viewerRole: string | null = null) => ({ __typename: 'Group', id, type: 'COMMUNITY', name, description: null, privacy: 'PUBLIC', joinPolicy: 'OPEN', memberCount: 3, viewerRole })
const doc = (s: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] })
const posts = (nodes: unknown[]) => ({ data: { group: { __typename: 'Group', id: GROUP, posts: { __typename: 'GroupPostConnection', pinned: [], edges: nodes.map((node) => ({ __typename: 'GroupPostEdge', node })), pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: null } } } } })
const post = (id: string, text: string) => ({ __typename: 'GroupPost', moderation: 'OK', moderationReason: null, moderationCanAppeal: false, id, kind: 'POST', body: doc(text), pinned: false, createdAt: new Date().toISOString(), editedAt: null, author: { __typename: 'User', id: 'o1', displayName: 'Meera Iyer', handle: 'meera' }, viewerCan: { __typename: 'GroupPostActions', edit: false, delete: false, pin: false }, discussion: { __typename: 'Discussion', commentCount: 0 } })
const inApollo = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)

beforeEach(() => jest.clearAllMocks())

it('the Community tab lists your groups and public ones to find', async () => {
  mockApi({
    MyGroups: () => ({ data: { myGroups: [card('g2', 'Compilers club', 'OWNER')] } }),
    DiscoverGroups: () => ({ data: { discoverGroups: [card(GROUP, 'Algorithms study'), card('g2', 'Compilers club', 'OWNER')] } }),
  })
  await inApollo(<CommunityScreen />)
  await fireEvent.press(screen.getByText('Groups & classes'))
  expect(await screen.findByText('Compilers club')).toBeOnTheScreen()
  expect(screen.getAllByText('Compilers club')).toHaveLength(1)
  await fireEvent.press(await screen.findByLabelText('Algorithms study'))
  expect(router.push).toHaveBeenCalledWith(`/groups/${GROUP}`)
})

it('asks to join with a note for the admins', async () => {
  let waiting = false
  const api = mockApi({
    Group: () => ({ data: { group: group(waiting ? { viewerRequestId: 'r1' } : { viewerCan: can({ requestJoin: true }) }) } }),
    RequestToJoinGroup: () => ((waiting = true), { data: { requestToJoinGroup: { __typename: 'GroupPayload', group: group({ viewerRequestId: 'r1' }), userErrors: [] } } }),
  })
  await inApollo(<GroupScreen id={GROUP} />)
  expect(await screen.findByText('Posts, notes and members are for members. Join to see them.')).toBeOnTheScreen()
  await fireEvent.press(screen.getByText('Ask to join'))
  await fireEvent.changeText(screen.getByLabelText('A note for the admins (optional)'), 'I study graphs')
  await fireEvent.press(screen.getByText('Send request'))
  expect(await screen.findByText('Your request is waiting for an answer.')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'RequestToJoinGroup')?.variables).toEqual({ groupId: GROUP, message: 'I study graphs' })
})

it('a member posts from the floating ＋ and shares a note with the group', async () => {
  let list = [post('p1', 'Week 2 is up')]
  let shared = false
  const api = mockApi({
    Group: () => ({ data: { group: group({ viewerRole: 'MEMBER', viewerCan: can({ post: true, leave: true }) }) } }),
    GroupPosts: () => posts(list),
    CreateGroupPost: () => {
      const created = post('p2', 'Hello all')
      list = [created, ...list]
      return { data: { createGroupPost: { __typename: 'GroupPostPayload', post: created, userErrors: [] } } }
    },
    GroupNotes: () => ({ data: { group: { __typename: 'Group', id: GROUP, sharedNotes: { __typename: 'NoteConnection', edges: shared ? [{ __typename: 'NoteEdge', node: { __typename: 'Note', id: 'n1', title: 'Binary heaps', kind: 'NOTE', visibility: 'SHARED', publishedAt: null, owner: { __typename: 'User', id: 'me', displayName: 'Ravi Kumar' } } }] : [] } } } }),
    ShareNoteToGroup: () => ((shared = true), { data: { shareNoteToGroup: { __typename: 'NotePayload', note: { __typename: 'Note', id: 'n1', visibility: 'SHARED' }, userErrors: [] } } }),
  })
  await inApollo(<GroupScreen id={GROUP} />)
  expect(await screen.findByText('Week 2 is up')).toBeOnTheScreen()
  expect(screen.queryByLabelText('Write a post')).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: 'New post' }))
  await fireEvent.changeText(screen.getByLabelText('Write a post'), 'Hello all')
  await fireEvent.press(screen.getByRole('button', { name: 'Post' }))
  expect(await screen.findByText('Hello all')).toBeOnTheScreen()
  expect(screen.queryByLabelText('Write a post')).toBeNull()
  expect(api.calls.find((c) => c.op === 'CreateGroupPost')?.variables).toEqual({ groupId: GROUP, body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello all' }] }] } })
  // Not on the other tabs.
  await fireEvent.press(screen.getByText('Members'))
  expect(screen.queryByRole('button', { name: 'New post' })).toBeNull()
  await fireEvent.press(screen.getByText('Posts'))
  await fireEvent.press(screen.getByText('Notes'))
  await fireEvent.press(await screen.findByText('Share one of your notes'))
  await fireEvent.press(await screen.findByLabelText('Share Binary heaps'))
  expect(await screen.findByText('by Ravi Kumar')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'ShareNoteToGroup')?.variables).toEqual({ noteId: 'n1', groupId: GROUP })
})

it('an admin approves a request to join', async () => {
  let pending = true
  const admin = () => group({ viewerRole: 'ADMIN', viewerCan: can({ post: true, moderate: true, manage: true, reviewRequests: true, leave: true }) })
  const api = mockApi({
    Group: () => ({ data: { group: admin() } }),
    GroupPosts: () => posts([]),
    GroupMembers: () => ({
      data: {
        group: {
          __typename: 'Group', id: GROUP, viewerRole: 'ADMIN', members: [],
          joinRequests: pending ? [{ __typename: 'GroupJoinRequest', id: 'jr1', message: 'I study graphs', createdAt: '2026-10-12T10:00:00.000Z', user: { __typename: 'User', id: 'u9', displayName: 'Asha Rao', handle: 'asha' } }] : [],
        },
      },
    }),
    ReviewGroupJoinRequest: () => ((pending = false), { data: { reviewGroupJoinRequest: { __typename: 'GroupPayload', group: { ...admin(), memberCount: 13 }, userErrors: [] } } }),
  })
  await inApollo(<GroupScreen id={GROUP} />)
  await fireEvent.press(await screen.findByText('Requests'))
  expect(await screen.findByText('“I study graphs”')).toBeOnTheScreen()
  await fireEvent.press(screen.getByText('Approve'))
  await waitFor(() => expect(api.calls.find((c) => c.op === 'ReviewGroupJoinRequest')?.variables).toEqual({ requestId: 'jr1', decision: 'APPROVED' }))
  expect(await screen.findByText('No requests waiting.')).toBeOnTheScreen()
})

it('chooses posts to delete together, after asking, and takes one’s own notes out of the group (owner, 2026-10-14)', async () => {
  const deletable = (id: string, text: string) => ({ ...post(id, text), viewerCan: { __typename: 'GroupPostActions', edit: false, delete: true, pin: false } })
  let list = [deletable('p1', 'Old timetable'), deletable('p2', 'Spam link'), post('p3', 'Someone else’s post')]
  const note = (id: string, title: string, owner: string) => ({ __typename: 'NoteEdge', node: { __typename: 'Note', id, title, kind: 'NOTE', visibility: 'SHARED', publishedAt: null, owner: { __typename: 'User', id: owner, displayName: owner === 'me' ? 'Ravi Kumar' : 'Meera Iyer' } } })
  let notes = [note('n1', 'Binary heaps', 'me'), note('n2', 'Graphs', 'o1')]
  const alert = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation((...args: unknown[]) => (args[2] as { text: string; onPress?: () => void }[]).find((b) => b.text === 'Delete' || b.text === 'Remove')?.onPress?.())
  const api = mockApi({
    Viewer: () => ({ data: { viewer: { __typename: 'User', id: 'me', handle: 'ravi', displayName: 'Ravi Kumar', email: 'ravi@example.com', emailVerified: true, registrationComplete: true, verified: true, verificationMethod: 'INSTITUTIONAL_EMAIL', globalRole: 'STUDENT', teacherStatus: 'NONE', restrictedMinor: false, institutionalEmail: null, institutionalEmailStatus: 'NONE', institution: null, deletionScheduledFor: null, avatarUrl: null } } }),
    Group: () => ({ data: { group: group({ viewerRole: 'ADMIN', viewerCan: can({ post: true, leave: true }) }) } }),
    GroupPosts: () => posts(list),
    DeleteGroupPost: (v) => ((list = list.filter((p) => p.id !== v.postId)), { data: { deleteGroupPost: { __typename: 'GroupPayload', group: { __typename: 'Group', id: GROUP }, userErrors: [] } } }),
    GroupNotes: () => ({ data: { group: { __typename: 'Group', id: GROUP, sharedNotes: { __typename: 'NoteConnection', edges: notes } } } }),
    UnshareNoteFromGroup: (v) => ((notes = notes.filter((n) => n.node.id !== v.noteId)), { data: { unshareNoteFromGroup: { __typename: 'NotePayload', note: { __typename: 'Note', id: v.noteId }, userErrors: [] } } }),
  })
  await inApollo(<GroupScreen id={GROUP} />)
  expect(await screen.findByText('Old timetable')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Select posts to delete' }))
  // Only one's own deletable posts can be chosen; the floating ＋ makes way for the bar.
  expect(screen.getAllByRole('checkbox')).toHaveLength(2)
  expect(screen.queryByRole('button', { name: 'New post' })).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: 'Select all' }))
  expect(screen.getByText('2 chosen')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Delete' }))
  await waitFor(() => expect(api.calls.filter((c) => c.op === 'DeleteGroupPost').map((c) => c.variables)).toEqual([{ postId: 'p1' }, { postId: 'p2' }]))
  expect(alert).toHaveBeenCalledWith('Delete 2 posts?', 'They are deleted for everyone in the group.', expect.anything())
  await waitFor(() => expect(screen.queryByText('Old timetable')).toBeNull())
  expect(screen.getByText('Someone else’s post')).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'New post' })).toBeOnTheScreen()

  // Notes: a long press on one's own starts choosing; another's cannot be chosen.
  await fireEvent.press(screen.getByText('Notes'))
  await fireEvent(await screen.findByText('Binary heaps'), 'longPress')
  expect(screen.getByText('1 chosen')).toBeOnTheScreen()
  expect(screen.getAllByRole('checkbox')).toHaveLength(1)
  await fireEvent.press(screen.getByRole('button', { name: 'Remove' }))
  await waitFor(() => expect(api.calls.find((c) => c.op === 'UnshareNoteFromGroup')?.variables).toEqual({ noteId: 'n1', groupId: GROUP }))
  await waitFor(() => expect(screen.queryByText('Binary heaps')).toBeNull())
  expect(screen.getByText('Graphs')).toBeOnTheScreen()
  alert.mockRestore()
})
