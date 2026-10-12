import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native'
import { router } from 'expo-router'
import { Alert } from 'react-native'
import { ExploreScreen } from '@/features/explore/ExploreScreen'
import { PeopleScreen } from '@/features/people/PeopleScreen'
import { ProfileScreen } from '@/features/people/ProfileScreen'
import { createApolloClient } from '@/lib/apollo'
import { mockApi } from '../../support/api'
import { renderInApp } from '../../support/render'

/** People on the phone (lvn-backend ADR-0043): profiles, follow and block, the viewer's lists, people in search. */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }))

const MEERA = '01920000-0000-7000-8000-0000000000e1'
const ME = '01920000-0000-7000-8000-00000000aaaa'
const can = (over: Record<string, boolean> = {}) => ({ __typename: 'RelationActions', follow: true, unfollow: false, removeFollower: false, block: true, unblock: false, restrict: true, unrestrict: false, requestConnection: false, respondToConnection: false, removeConnection: false, ...over })
const relation = (over: Record<string, unknown> = {}, actions: Record<string, boolean> = {}) => ({ __typename: 'Relation', following: false, followedBy: false, blocked: false, restricted: false, connected: false, pendingConnection: null, viewerCan: can(actions), ...over })
const SKILLS = { __typename: 'TeacherProfile', headline: 'Teaches algorithms', bio: null, skills: [{ __typename: 'TeacherSkill', id: 's1', kind: 'QUALIFICATION', name: 'M.Tech, Computer Science', detail: 'IIT Madras, 2014' }] }
const profile = (rel: unknown, viewerId = ME, verified = true) => ({
  data: {
    userByHandle: {
      __typename: 'User', id: MEERA, handle: 'meera', displayName: 'Meera Iyer', globalRole: 'TEACHER', verified: true, followerMilestone: 1000,
      followerCount: viewerId === MEERA ? 1200 : null, followingCount: viewerId === MEERA ? 4 : null, profile: null, relation: rel, teacherProfile: SKILLS,
      publicNotes: { __typename: 'NoteConnection', edges: [{ __typename: 'NoteEdge', node: { __typename: 'Note', id: 'n1', title: 'Heaps, explained', kind: 'NOTE', publishedAt: '2026-10-02T10:00:00.000Z' } }] },
    },
    viewer: { __typename: 'User', id: viewerId, verified },
  },
})
const payload = (name: string, rel: unknown) => ({ data: { [name]: { __typename: 'PersonPayload', user: { __typename: 'User', id: MEERA, relation: rel }, userErrors: [] } } })
const inApollo = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)

beforeEach(() => jest.clearAllMocks())

it('shows a teacher’s profile; Follow, then Following', async () => {
  let rel = relation()
  const api = mockApi({
    Profile: () => profile(rel),
    FollowUser: () => ((rel = relation({ following: true }, { follow: false, unfollow: true })), payload('followUser', rel)),
  })
  await inApollo(<ProfileScreen handle="meera" />)
  expect(await screen.findByText('Meera Iyer')).toBeOnTheScreen()
  expect(screen.getByText('Teacher')).toBeOnTheScreen()
  expect(screen.getByText('1,000+ followers')).toBeOnTheScreen()
  expect(screen.getByText('Notes 1')).toBeOnTheScreen()
  await fireEvent.press(screen.getByText('Heaps, explained'))
  expect(router.push).toHaveBeenCalledWith('/notes/n1')
  await fireEvent.press(screen.getByText('Follow'))
  expect(await screen.findByLabelText('Following, tap to unfollow')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'FollowUser')?.variables).toEqual({ input: { userId: MEERA } })
})

it('blocks only after the person reads what it does', async () => {
  const alert = jest.spyOn(Alert, 'alert')
  let rel = relation()
  const api = mockApi({
    Profile: () => profile(rel),
    BlockUser: () => ((rel = relation({ blocked: true }, { follow: false, block: false, unblock: true, restrict: false })), payload('blockUser', rel)),
  })
  await inApollo(<ProfileScreen handle="meera" />)
  await fireEvent.press(await screen.findByLabelText('More options'))
  // The menu is a sheet (Android's alert drops a fourth button): Restrict, Block, Report.
  expect(screen.getAllByRole('menuitem').map((m) => within(m).getByText(/./).props.children)).toEqual(['Restrict', 'Block', 'Report'])
  await fireEvent.press(screen.getByRole('menuitem', { name: 'Block' }))
  expect(alert.mock.calls.at(-1)![0]).toBe('Block this person?')
  expect(alert.mock.calls.at(-1)![1]).toMatch(/They are not told/)
  alert.mock.calls.at(-1)![2]!.find((b) => b.text === 'Block')!.onPress!()
  expect(await screen.findByText('Unblock')).toBeOnTheScreen()
  expect(api.ops()).toContain('BlockUser')
})

it('shows a refusal in the API’s words', async () => {
  mockApi({
    Profile: () => profile(relation()),
    FollowUser: () => ({ data: null, errors: [{ message: 'Verify your account to follow people.', extensions: { code: 'FORBIDDEN' } }] }),
  })
  await inApollo(<ProfileScreen handle="meera" />)
  await fireEvent.press(await screen.findByText('Follow'))
  expect(await screen.findByText('Verify your account to follow people.')).toBeOnTheScreen()
})

it('an unverified viewer still sees Follow, and learns why it needs verification', async () => {
  mockApi({
    Profile: () => profile(relation({}, { follow: false }), ME, false),
    FollowUser: () => ({ data: null, errors: [{ message: 'Verify your account to follow people.', extensions: { code: 'FORBIDDEN' } }] }),
  })
  await inApollo(<ProfileScreen handle="meera" />)
  await fireEvent.press(await screen.findByText('Follow'))
  expect(await screen.findByText('Verify your account to follow people.')).toBeOnTheScreen()
})

it('on one’s own profile: exact counts, leading to the lists', async () => {
  mockApi({ Profile: () => profile(null, MEERA) })
  await inApollo(<ProfileScreen handle="meera" />)
  await fireEvent.press(await screen.findByText('1200 followers · 4 following'))
  expect(router.push).toHaveBeenCalledWith('/people')
  expect(screen.queryByText('Follow')).toBeNull()
})

it('lists followers, counting young learners without naming them, and removes one', async () => {
  const person = { __typename: 'User', id: MEERA, handle: 'meera', displayName: 'Meera Iyer', globalRole: 'TEACHER', verified: true }
  let followers = [person]
  const api = mockApi({
    MyPeople: () => ({
      data: {
        viewer: { __typename: 'User', id: ME, handle: 'ravi', globalRole: 'STUDENT', followerCount: followers.length + 1, followingCount: 0 },
        myConnections: [],
        myConnectionRequests: [],
        myFollowers: { __typename: 'PersonConnection', edges: followers.map((node) => ({ __typename: 'PersonEdge', since: '2026-10-10T10:00:00.000Z', node })), pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: null } },
        myFollowing: { __typename: 'PersonConnection', edges: [], pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: null } },
        myBlocked: [],
        myRestricted: [],
      },
    }),
    RemoveFollower: () => ((followers = []), { data: { removeFollower: { __typename: 'PersonPayload', user: null, userErrors: [] } } }),
  })
  await inApollo(<PeopleScreen />)
  expect(await screen.findByText('Followers 2')).toBeOnTheScreen()
  expect(screen.getByText('1 more follower is not shown by name: young learners never appear in lists.')).toBeOnTheScreen()
  await fireEvent.press(screen.getByLabelText('Remove Meera Iyer'))
  await waitFor(() => expect(api.ops()).toContain('RemoveFollower'))
  expect(await screen.findByText('Followers 1')).toBeOnTheScreen()
})

it('Explore finds people and opens their profile', async () => {
  mockApi({
    SearchNotes: () => ({ data: { search: { __typename: 'SearchResults', notes: [], topics: [], people: [{ __typename: 'User', id: MEERA, handle: 'meera', displayName: 'Meera Iyer', globalRole: 'TEACHER' }] } } }),
  })
  await inApollo(<ExploreScreen />)
  await fireEvent.changeText(screen.getByLabelText('Search notes, people and topics'), 'meera')
  await fireEvent.press(await screen.findByLabelText('Meera Iyer, @meera'))
  expect(router.push).toHaveBeenCalledWith('/u/meera')
})

it('a teacher’s Skills tab, and connecting: Connect, then Requested', async () => {
  let rel = relation({}, { requestConnection: true })
  const api = mockApi({
    Profile: () => profile(rel),
    RequestConnection: () => ((rel = relation({ pendingConnection: { __typename: 'PendingConnection', direction: 'OUTGOING', requestId: 'r1' } })), payload('requestConnection', rel)),
  })
  await inApollo(<ProfileScreen handle="meera" />)
  await fireEvent.press(await screen.findByText('Skills'))
  expect(screen.getByText('Teaches algorithms')).toBeOnTheScreen()
  expect(screen.getByText('IIT Madras, 2014')).toBeOnTheScreen()
  await fireEvent.press(screen.getByText('Connect'))
  expect(await screen.findByLabelText('Connection requested, tap to withdraw')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'RequestConnection')?.variables).toEqual({ input: { userId: MEERA } })
})

it('a teacher accepts a connection request from the people screen', async () => {
  const meera = { __typename: 'User', id: MEERA, handle: 'meera', displayName: 'Meera Iyer', globalRole: 'TEACHER', verified: true }
  let pending = true
  const api = mockApi({
    MyPeople: () => ({
      data: {
        viewer: { __typename: 'User', id: ME, handle: 'asha', globalRole: 'TEACHER', followerCount: 0, followingCount: 0 },
        myFollowers: { __typename: 'PersonConnection', edges: [], pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: null } },
        myFollowing: { __typename: 'PersonConnection', edges: [], pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: null } },
        myConnections: pending ? [] : [{ __typename: 'PersonEdge', since: '2026-10-12T10:00:00.000Z', node: meera }],
        myConnectionRequests: pending ? [{ __typename: 'ConnectionRequestItem', id: 'r9', direction: 'INCOMING', createdAt: '2026-10-12T10:00:00.000Z', person: meera }] : [],
        myBlocked: [],
        myRestricted: [],
      },
    }),
    RespondToConnectionRequest: () => ((pending = false), { data: { respondToConnectionRequest: { __typename: 'PersonPayload', user: { __typename: 'User', id: MEERA, relation: relation({ connected: true }) }, userErrors: [] } } }),
  })
  await inApollo(<PeopleScreen />)
  await fireEvent.press(await screen.findByText('Requests 1'))
  await fireEvent.press(screen.getByLabelText('Accept Meera Iyer'))
  await waitFor(() => expect(api.calls.find((c) => c.op === 'RespondToConnectionRequest')?.variables).toEqual({ input: { requestId: 'r9', accept: true } }))
  expect(await screen.findByText('Connections 1')).toBeOnTheScreen()
})

it('reports a person from the menu (lvn-backend ADR-0051)', async () => {
  const api = mockApi({
    Profile: () => profile(relation()),
    ReportContent: () => ({ data: { reportContent: { __typename: 'OkPayload', ok: true, userErrors: [] } } }),
  })
  await inApollo(<ProfileScreen handle="meera" />)
  await fireEvent.press(await screen.findByLabelText('More options'))
  await fireEvent.press(screen.getByRole('menuitem', { name: 'Report' }))
  expect(await screen.findByText('Report this person')).toBeOnTheScreen()
  await fireEvent.press(screen.getByLabelText('Spam or advertising'))
  await fireEvent.press(screen.getByText('Send report'))
  expect(await screen.findByText('Thank you for telling us')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'ReportContent')?.variables).toEqual({ input: { entityType: 'USER', entityId: MEERA, reason: 'SPAM', details: null } })
})
