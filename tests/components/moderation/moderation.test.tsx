import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native'
import { ClassScreen } from '@/features/classes/ClassScreen'
import { PlatformQueueScreen } from '@/features/moderation/PlatformQueueScreen'
import { GroupScreen } from '@/features/groups/GroupScreen'
import { createApolloClient } from '@/lib/apollo'
import { mockApi, viewer } from '../../support/api'
import { renderInApp } from '../../support/render'

/**
 * Moderation on the phone (lvn-backend ADR-0051): reporting what others wrote, the author's notice and one appeal,
 * and a group's or a class's reports for its moderators.
 */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }))
jest.mock('@/features/notes/store/db', () => ({ listNotes: jest.fn(async () => []), subscribe: () => () => {} }))

const ME = '01920000-0000-7000-8000-00000000aaaa'
const OTHER = '01920000-0000-7000-8000-00000000bbbb'
const GROUP = '01920000-0000-7000-8000-0000000a0001'
const CLASS = '01920000-0000-7000-8000-0000000c0001'
const meera = { __typename: 'User', id: OTHER, displayName: 'Meera Iyer', handle: 'meera' }
const asha = { __typename: 'User', id: ME, displayName: 'Asha Rao', handle: 'asharao' }
const doc = (s: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] })
const ok = (name: string) => ({ data: { [name]: { __typename: 'OkPayload', ok: true, userErrors: [] } } })
const can = (over: Record<string, boolean> = {}) => ({ __typename: 'GroupActions', join: false, requestJoin: false, post: false, moderate: false, manage: false, delete: false, reviewRequests: false, leave: false, askDoubt: false, inviteMentor: false, acceptMentorInvite: false, ...over })
const group = (over: Record<string, unknown> = {}) => ({ __typename: 'Group', id: GROUP, type: 'COMMUNITY', moderationWarning: null, viewerMentorInviteId: null, name: 'Algorithms study', description: null, privacy: 'PUBLIC', joinPolicy: 'OPEN', memberCount: 12, viewerRole: 'MEMBER', createdAt: '2026-10-01T10:00:00.000Z', viewerRequestId: null, owner: { __typename: 'User', id: OTHER, displayName: 'Meera Iyer' }, viewerCan: can({ post: true, leave: true }), ...over })
const post = (id: string, text: string, over: Record<string, unknown> = {}) => ({ __typename: 'GroupPost', id, kind: 'POST', moderation: 'OK', moderationReason: null, moderationCanAppeal: false, body: doc(text), pinned: false, createdAt: new Date().toISOString(), editedAt: null, author: meera, viewerCan: { __typename: 'GroupPostActions', edit: false, delete: false, pin: false }, discussion: { __typename: 'Discussion', commentCount: 0 }, ...over })
const posts = (nodes: unknown[]) => ({ data: { group: { __typename: 'Group', id: GROUP, posts: { __typename: 'GroupPostConnection', pinned: [], edges: nodes.map((node) => ({ __typename: 'GroupPostEdge', node })), pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: null } } } } })
const queue = (nodes: unknown[]) => ({ data: { moderationQueue: { __typename: 'ModerationCaseConnection', edges: nodes.map((node, i) => ({ __typename: 'ModerationCaseEdge', cursor: String(i), node })), pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: null } } } })
const content = (over: Record<string, unknown>) => ({ __typename: 'ModeratedContent', entityType: 'GROUP_POST', id: 'p2', excerpt: 'You are all hopeless at heaps.', moderation: 'OK', moderationReason: null, deleted: false, path: `/groups/${GROUP}`, author: meera, ...over })
const inApollo = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)

beforeEach(() => jest.clearAllMocks())

it('a member reports someone else’s post, and appeals once against hiding their own', async () => {
  let appealed = false
  const mine = post('p9', 'My hot take', { author: asha, moderation: 'HIDDEN', moderationReason: 'Be kind to the others.', moderationCanAppeal: true })
  const api = mockApi({
    Viewer: () => ({ data: { viewer: viewer() } }),
    Group: () => ({ data: { group: group() } }),
    GroupPosts: () => posts([post('p2', 'You are all hopeless'), appealed ? { ...mine, moderationCanAppeal: false } : mine]),
    ReportContent: () => ok('reportContent'),
    AppealModeration: () => ((appealed = true), ok('appealModeration')),
  })
  await inApollo(<GroupScreen id={GROUP} />)
  expect(await screen.findByText('You are all hopeless')).toBeOnTheScreen()
  expect(screen.queryByText('Reports')).toBeNull()
  // The flag is on others' posts only; the group, owned by someone else, can be reported too.
  await waitFor(() => expect(screen.getAllByLabelText('Report this post')).toHaveLength(1))
  expect(screen.getByLabelText('Report this group')).toBeOnTheScreen()
  await fireEvent.press(screen.getByLabelText('Report this post'))
  expect(await screen.findByText('Report this post')).toBeOnTheScreen()
  await fireEvent.press(screen.getByLabelText('Bullying or harassment'))
  await fireEvent.changeText(screen.getByLabelText('Anything moderators should know (optional)'), 'Rude to everyone')
  await fireEvent.press(screen.getByText('Send report'))
  expect(await screen.findByText('Thank you for telling us')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'ReportContent')?.variables).toEqual({ input: { entityType: 'GROUP_POST', entityId: 'p2', reason: 'HARASSMENT', details: 'Rude to everyone' } })
  await fireEvent.press(screen.getByText('Done'))

  expect(screen.getByText('Hidden by moderators')).toBeOnTheScreen()
  expect(screen.getByText('Be kind to the others.')).toBeOnTheScreen()
  await fireEvent.press(screen.getByText('Appeal'))
  await fireEvent.changeText(screen.getByLabelText('Your message'), 'It was a joke among friends.')
  await fireEvent.press(screen.getByText('Send appeal'))
  expect(await screen.findByText('Your appeal is with the moderators.')).toBeOnTheScreen()
  expect(screen.queryByText('Appeal')).toBeNull()
  expect(api.calls.find((c) => c.op === 'AppealModeration')?.variables).toEqual({ input: { entityType: 'GROUP_POST', entityId: 'p9', message: 'It was a joke among friends.' } })
})

it('group moderators review the group’s reports: mute the author, hide with a reason', async () => {
  let open = true
  const item = { __typename: 'ModerationCase', suspendedUntil: null, removedGroup: null, entityType: 'GROUP_POST', entityId: 'p2', scope: 'GROUP', scopeId: GROUP, openedAt: new Date().toISOString(), note: null, group: null, user: null, appeal: null, content: content({}), reports: [{ __typename: 'ModerationReport', reason: 'HARASSMENT', details: 'Rude to everyone', createdAt: new Date().toISOString(), reporter: { __typename: 'User', id: ME, displayName: 'Asha Rao' } }] }
  const api = mockApi({
    Viewer: () => ({ data: { viewer: viewer() } }),
    Group: () => ({ data: { group: group({ viewerRole: 'MODERATOR', viewerCan: can({ post: true, moderate: true, leave: true }) }) } }),
    GroupPosts: () => posts([]),
    ModerationQueue: () => queue(open ? [item] : []),
    MuteGroupMember: () => ({ data: { muteGroupMember: { __typename: 'GroupPayload', group: { __typename: 'Group', id: GROUP }, userErrors: [] } } }),
    ModerateContent: () => ((open = false), ok('moderateContent')),
  })
  await inApollo(<GroupScreen id={GROUP} />)
  await fireEvent.press(await screen.findByText('Reports'))
  const card = await screen.findByLabelText('Post case')
  expect(within(card).getByText('You are all hopeless at heaps.')).toBeOnTheScreen()
  expect(within(card).getByText(/Rude to everyone/)).toBeOnTheScreen()
  expect(within(card).queryByText('Approve')).toBeNull()
  expect(api.calls.find((c) => c.op === 'ModerationQueue')?.variables).toMatchObject({ scope: { scope: 'GROUP', id: GROUP } })
  await fireEvent.press(within(card).getByText('Mute the author for a day'))
  expect(await within(card).findByText('Muted for a day')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'MuteGroupMember')?.variables).toMatchObject({ groupId: GROUP, userId: OTHER })
  await fireEvent.press(within(card).getByText('Hide'))
  expect(within(card).getByText('Write a reason first: the author is told.')).toBeOnTheScreen()
  await fireEvent.changeText(within(card).getByLabelText('Reason (the author sees it)'), 'Be kind to the others.')
  await fireEvent.press(within(card).getByText('Hide'))
  expect(await screen.findByText('Nothing to review. Thank you!')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'ModerateContent')?.variables).toEqual({ input: { entityType: 'GROUP_POST', entityId: 'p2', action: 'HIDE', reason: 'Be kind to the others.' } })
})

it('the owner reads the platform moderators’ warning on the group', async () => {
  mockApi({
    Viewer: () => ({ data: { viewer: viewer() } }),
    Group: () => ({ data: { group: group({ viewerRole: 'OWNER', moderationWarning: 'Rename the group, please.', owner: { __typename: 'User', id: ME, displayName: 'Asha Rao' }, viewerCan: can({ post: true, moderate: true, manage: true }) }) } }),
    GroupPosts: () => posts([]),
  })
  await inApollo(<GroupScreen id={GROUP} />)
  expect(await screen.findByText('A warning from the moderators')).toBeOnTheScreen()
  expect(screen.getByText('Rename the group, please.')).toBeOnTheScreen()
  expect(screen.queryByLabelText('Report this group')).toBeNull()
})

it('class staff put back a held comment from the class’s reports', async () => {
  let open = true
  const ccan = { __typename: 'ClassroomActions', publishQuiz: false, requestJoin: false, acceptInvite: false, review: true, post: true, manage: true, leave: false }
  const item = { __typename: 'ModerationCase', suspendedUntil: null, removedGroup: null, entityType: 'COMMENT', entityId: 'c1', scope: 'CLASSROOM', scopeId: CLASS, openedAt: new Date().toISOString(), note: null, group: null, user: null, appeal: null, content: content({ entityType: 'COMMENT', id: 'c1', excerpt: 'Buy followers here', moderation: 'PENDING_REVIEW', path: `/classes/${CLASS}` }), reports: [{ __typename: 'ModerationReport', reason: 'SPAM', details: null, createdAt: new Date().toISOString(), reporter: null }] }
  const api = mockApi({
    Viewer: () => ({ data: { viewer: viewer() } }),
    Classroom: () => ({ data: { classroom: { __typename: 'Classroom', id: CLASS, name: 'Physics 9A', description: null, memberCount: 31, viewerRole: 'TEACHER', teacher: asha, createdAt: '2026-10-01T10:00:00.000Z', joinCode: 'K7PQ2MXA', viewerRequestId: null, viewerInviteId: null, viewerCan: ccan } } }),
    ClassroomPosts: () => ({ data: { classroom: { __typename: 'Classroom', id: CLASS, posts: { __typename: 'ClassroomPostConnection', edges: [], pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: null } } } } }),
    ModerationQueue: () => queue(open ? [item] : []),
    ModerateContent: () => ((open = false), ok('moderateContent')),
  })
  await inApollo(<ClassScreen id={CLASS} />)
  await fireEvent.press(await screen.findByText('Reports'))
  const card = await screen.findByLabelText('Comment case')
  expect(within(card).getByText('Held')).toBeOnTheScreen()
  expect(within(card).getByText(/held automatically/)).toBeOnTheScreen()
  expect(within(card).queryByText('Mute the author for a day')).toBeNull()
  await fireEvent.press(within(card).getByText('Approve'))
  expect(await screen.findByText('Nothing to review. Thank you!')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'ModerateContent')?.variables).toEqual({ input: { entityType: 'COMMENT', entityId: 'c1', action: 'APPROVE', reason: null } })
})

it('platform admins review every scope on the phone: a note, a group, an account and a class’s case', async () => {
  let decided = false
  const reportBy = (reason: string) => [{ __typename: 'ModerationReport', reason, details: null, createdAt: new Date().toISOString(), reporter: { __typename: 'User', id: ME, displayName: 'Asha Rao' } }]
  const base = { __typename: 'ModerationCase', suspendedUntil: null, removedGroup: null, scopeId: null, openedAt: new Date().toISOString(), note: null, group: null, user: null, content: null, appeal: null }
  const cases = [
    { ...base, entityType: 'NOTE', entityId: 'n1', scope: 'PLATFORM', note: { __typename: 'Note', id: 'n1', title: 'Exam answers', excerpt: 'Leaked paper', visibility: 'PUBLIC', moderation: 'HIDDEN', moderationReason: 'Copied', deleted: false, owner: meera }, appeal: { __typename: 'ModerationAppeal', message: 'These are my own answers.', createdAt: new Date().toISOString() }, reports: reportBy('COPYRIGHT') },
    { ...base, entityType: 'GROUP', entityId: GROUP, scope: 'PLATFORM', group: { __typename: 'Group', id: GROUP, name: 'Algorithms study' }, reports: reportBy('SPAM') },
    { ...base, entityType: 'USER', entityId: OTHER, scope: 'PLATFORM', user: meera, reports: reportBy('HARASSMENT') },
    { ...base, entityType: 'CLASSROOM_POST', entityId: 'cp1', scope: 'CLASSROOM', scopeId: CLASS, content: content({ entityType: 'CLASSROOM_POST', id: 'cp1', excerpt: 'Homework is cancelled forever' }), reports: reportBy('OTHER') },
  ]
  const api = mockApi({
    Viewer: () => ({ data: { viewer: viewer({ globalRole: 'PLATFORM_ADMIN' }) } }),
    ModerationQueue: () => queue(decided ? cases.slice(1) : cases),
    ModerateContent: () => ((decided = true), ok('moderateContent')),
  })
  await inApollo(<PlatformQueueScreen />)
  const note = await screen.findByLabelText('Note case')
  expect(api.calls.find((c) => c.op === 'ModerationQueue')?.variables).toEqual({})
  expect(within(note).getByText('Exam answers')).toBeOnTheScreen()
  expect(within(note).getByText('These are my own answers.')).toBeOnTheScreen()
  expect(within(note).getByText('Put it back')).toBeOnTheScreen()
  expect(within(note).getByText('Keep the decision')).toBeOnTheScreen()
  // A group is warned or removed, an account only warned; neither is hidden.
  expect(within(screen.getByLabelText('Group case')).queryByText('Hide')).toBeNull()
  expect(within(screen.getByLabelText('Group case')).getByText('Remove')).toBeOnTheScreen()
  expect(within(screen.getByLabelText('Account case')).queryByText('Remove')).toBeNull()
  expect(within(screen.getByLabelText('Account case')).getByText('Meera Iyer (@meera)')).toBeOnTheScreen()
  // Where a case comes from, when it is not the platform's own.
  expect(within(screen.getByLabelText('Announcement case')).getByText('In a class')).toBeOnTheScreen()
  expect(within(note).queryByText('In a class')).toBeNull()
  await fireEvent.press(within(note).getByText('Put it back'))
  await waitFor(() => expect(screen.queryByLabelText('Note case')).toBeNull())
  expect(api.calls.find((c) => c.op === 'ModerateContent')?.variables).toEqual({ input: { entityType: 'NOTE', entityId: 'n1', action: 'APPROVE', reason: null } })
})

it('anyone else is told the platform queue is for admins, and nothing is fetched', async () => {
  const api = mockApi({ Viewer: () => ({ data: { viewer: viewer() } }) })
  await inApollo(<PlatformQueueScreen />)
  expect(await screen.findByText('The moderation queue is for platform admins.')).toBeOnTheScreen()
  expect(api.ops()).not.toContain('ModerationQueue')
})
