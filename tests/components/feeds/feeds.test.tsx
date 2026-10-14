import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import { CommunityScreen } from '@/features/groups/CommunityScreen'
import { createApolloClient } from '@/lib/apollo'
import { mockApi } from '../../support/api'
import { renderInApp } from '../../support/render'

/**
 * Feeds in the Community tab (lvn-backend ADR-0049, ADR-0076): it opens on For You; the activity of your places, and
 * the Following feed.
 */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() }, useLocalSearchParams: () => ({}) }))

const GROUP = '01920000-0000-7000-8000-0000000a0009'
const meera = { __typename: 'User', id: 'u2', displayName: 'Meera Iyer', handle: 'meera' }
const doc = (s: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] })
const page = (edges: unknown[], hasNextPage = false) => ({ edges, pageInfo: { __typename: 'PageInfo', hasNextPage, endCursor: hasNextPage ? 'c1' : null } })
const item = (key: string, kind: string, over: Record<string, unknown>) => ({ __typename: 'ActivityEdge', node: { __typename: 'ActivityItem', key, kind, at: new Date().toISOString(), actor: meera, group: null, classroom: null, post: null, announcement: null, doubt: null, note: null, repositoryEvent: null, ...over } })
const group = { __typename: 'Group', id: GROUP, name: 'Heap team' }
const inApollo = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)
const forYou = () => ({ data: { forYouFeed: { __typename: 'CommunityConnection', ...page([]), basedOn: [] } } })

beforeEach(() => jest.clearAllMocks())

it('the activity of your places adds older items and opens a doubt', async () => {
  const api = mockApi({
    ForYouFeed: forYou,
    ActivityFeed: (v) => ({
      data: {
        activityFeed: {
          __typename: 'ActivityConnection',
          ...(v.after
            ? page([item('k2', 'GROUP_POST', { group, post: { __typename: 'GroupPost', id: 'p1', body: doc('Standup at 5'), discussion: { __typename: 'Discussion', commentCount: 2 } } })])
            : page([item('k1', 'DOUBT', { group, doubt: { __typename: 'Doubt', id: 'd1', title: 'Which heap library?', status: 'OPEN' } }), item('k0', 'SHARED_NOTE', { group, note: null })], true)),
        },
      },
    }),
  })
  await inApollo(<CommunityScreen />)
  expect(screen.getByRole('tab', { name: 'For You' })).toBeSelected()
  await fireEvent.press(screen.getByRole('tab', { name: 'Activity' }))
  expect(await screen.findByText('Which heap library?')).toBeOnTheScreen()
  await fireEvent.press(screen.getByText('Show more'))
  expect(await screen.findByText('Standup at 5')).toBeOnTheScreen()
  expect(screen.getByText('Which heap library?')).toBeOnTheScreen()
  expect(screen.getByText('2 comments')).toBeOnTheScreen()
  await fireEvent.press(screen.getByText('Which heap library?'))
  expect(router.push).toHaveBeenCalledWith(`/groups/${GROUP}/doubts/d1`)
  expect(api.calls.filter((c) => c.op === 'ActivityFeed').map((c) => c.variables)).toEqual([{}, { after: 'c1' }])
})

it('the Following feed lists followed people’s public notes', async () => {
  mockApi({
    ForYouFeed: forYou,
    ActivityFeed: () => ({ data: { activityFeed: { __typename: 'ActivityConnection', ...page([]) } } }),
    FollowingFeed: () => ({ data: { followingFeed: { __typename: 'NoteConnection', ...page([{ __typename: 'NoteEdge', node: { __typename: 'Note', id: 'n9', title: 'Why heaps matter', slug: 'why-heaps-matter', kind: 'BLOG', publishedAt: new Date().toISOString(), owner: meera } }]) } } }),
  })
  await inApollo(<CommunityScreen />)
  await fireEvent.press(screen.getByRole('tab', { name: 'Activity' }))
  expect(await screen.findByText(/Nothing new in your groups and classes yet/)).toBeOnTheScreen()
  await fireEvent.press(screen.getByText('Following'))
  await fireEvent.press(await screen.findByLabelText('Why heaps matter'))
  await waitFor(() => expect(router.push).toHaveBeenCalledWith('/notes/n9'))
  expect(screen.getByText(/Blog · Meera Iyer/)).toBeOnTheScreen()
})
