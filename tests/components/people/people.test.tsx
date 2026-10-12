import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
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
const can = (over: Record<string, boolean> = {}) => ({ __typename: 'RelationActions', follow: true, unfollow: false, removeFollower: false, block: true, unblock: false, restrict: true, unrestrict: false, ...over })
const relation = (over: Record<string, unknown> = {}, actions: Record<string, boolean> = {}) => ({ __typename: 'Relation', following: false, followedBy: false, blocked: false, restricted: false, viewerCan: can(actions), ...over })
const profile = (rel: unknown, viewerId = ME) => ({
  data: {
    userByHandle: {
      __typename: 'User', id: MEERA, handle: 'meera', displayName: 'Meera Iyer', globalRole: 'TEACHER', verified: true, followerMilestone: 1000,
      followerCount: viewerId === MEERA ? 1200 : null, followingCount: viewerId === MEERA ? 4 : null, profile: null, relation: rel,
      publicNotes: { __typename: 'NoteConnection', edges: [{ __typename: 'NoteEdge', node: { __typename: 'Note', id: 'n1', title: 'Heaps, explained', kind: 'NOTE', publishedAt: '2026-10-02T10:00:00.000Z' } }] },
    },
    viewer: { __typename: 'User', id: viewerId },
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
  const menu = alert.mock.calls.at(-1)![2]!
  menu.find((b) => b.text === 'Block')!.onPress!()
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
        viewer: { __typename: 'User', id: ME, handle: 'ravi', followerCount: followers.length + 1, followingCount: 0 },
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
