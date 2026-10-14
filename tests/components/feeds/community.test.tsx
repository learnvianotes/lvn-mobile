import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import { InterestsCard } from '@/features/auth/Interests'
import { ForYouFeed, TrendingFeed } from '@/features/feeds/Feeds'
import { createApolloClient } from '@/lib/apollo'
import { mockApi } from '../../support/api'
import { renderInApp } from '../../support/render'

/**
 * Community's For You and Trending on the phone (lvn-backend ADR-0076): post cards whose every part leads somewhere,
 * empty sections that lead to topics, exams or For You, and the topics a person follows, chosen in Settings.
 */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() }, useLocalSearchParams: () => ({}) }))
jest.mock('@/lib/haptics', () => ({ haptic: { tick: jest.fn(), press: jest.fn(), success: jest.fn() } }))

const NOTE = '01920000-0000-7000-8000-00000000a0c1'
const TOPIC = { __typename: 'Topic', id: '01920000-0000-7000-8000-0000000070a1', title: 'Heaps' }
const ME = '01920000-0000-7000-8000-00000000aaaa'
const inApp = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)
const post = (over: Record<string, unknown> = {}) => ({
  __typename: 'Note',
  id: NOTE,
  title: 'Heaps in ten minutes',
  kind: 'POST',
  publishedAt: new Date().toISOString(),
  excerpt: 'A heap keeps the smallest item on top.',
  viewerSaved: false,
  owner: { __typename: 'User', id: '01920000-0000-7000-8000-00000000bbbb', displayName: 'Meera Iyer', profile: { __typename: 'StudentProfile', department: 'CSE' } },
  topics: [TOPIC],
  previewPicture: null,
  discussion: { __typename: 'Discussion', commentCount: 3 },
  ...over,
})
const connection = (name: string, edges: unknown[], basedOn: unknown[] = []) => ({ data: { [name]: { __typename: 'CommunityConnection', edges, pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: null }, basedOn } } })

beforeEach(() => jest.clearAllMocks())

it('For You shows post cards: the card opens the note, the topic its notes, and Save saves', async () => {
  const api = mockApi({
    ForYouFeed: () => connection('forYouFeed', [{ __typename: 'CommunityEdge', cursor: 'c', node: post(), topic: TOPIC }], [TOPIC]),
    SaveNote: () => ({ data: { saveNote: { __typename: 'NotePayload', note: { __typename: 'Note', id: NOTE, viewerSaved: true }, userErrors: [] } } }),
  })
  await inApp(<ForYouFeed />)
  await fireEvent.press(await screen.findByRole('link', { name: 'Heaps in ten minutes' }))
  expect(router.push).toHaveBeenLastCalledWith(`/notes/${NOTE}`)
  expect(screen.getByText(/Meera Iyer · CSE/)).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('link', { name: 'Notes on Heaps' }))
  expect(router.push).toHaveBeenLastCalledWith({ pathname: '/explore', params: { topic: TOPIC.id, topicTitle: 'Heaps' } })
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByRole('button', { name: 'Saved' })).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'SaveNote')?.variables).toEqual({ noteId: NOTE })
})

it('with no topics, For You leads to choosing some or adding an exam', async () => {
  mockApi({ ForYouFeed: () => connection('forYouFeed', []) })
  await inApp(<ForYouFeed />)
  await fireEvent.press(await screen.findByRole('link', { name: 'Choose topics' }))
  expect(router.push).toHaveBeenLastCalledWith('/settings')
  await fireEvent.press(screen.getByRole('link', { name: 'Add an exam' }))
  expect(router.push).toHaveBeenLastCalledWith('/exams')
})

it('an empty Trending leads back to For You; a full one lists cards', async () => {
  mockApi({ TrendingFeed: () => connection('trendingFeed', []) })
  const onForYou = jest.fn()
  const view = await inApp(<TrendingFeed onForYou={onForYou} />)
  await fireEvent.press(await screen.findByRole('link', { name: 'See For You' }))
  expect(onForYou).toHaveBeenCalled()
  await view.unmount()
  mockApi({ TrendingFeed: () => connection('trendingFeed', [{ __typename: 'CommunityEdge', cursor: 'c', node: post({ title: 'Most talked about' }), topic: null }]) })
  await inApp(<TrendingFeed onForYou={onForYou} />)
  expect(await screen.findByRole('link', { name: 'Most talked about' })).toBeOnTheScreen()
})

it('the topics a person follows: added from a search, removed in one tap', async () => {
  let chosen: unknown[] = []
  const api = mockApi({
    MyInterests: () => ({ data: { viewer: { __typename: 'User', id: ME, profile: { __typename: 'StudentProfile', interests: chosen } } } }),
    FindTopics: () => ({ data: { findTopics: [{ __typename: 'Topic', id: TOPIC.id, title: 'Heaps', origin: 'CURATED', subject: { __typename: 'Subject', id: 's1', title: 'Data structures' } }] } }),
    SetInterests: (v) => {
      chosen = (v.ids as string[]).map((id) => ({ __typename: 'Topic', id, title: 'Heaps', subject: { __typename: 'Subject', id: 's1', title: 'Data structures' } }))
      return { data: { updateProfile: { __typename: 'ProfilePayload', profile: { __typename: 'StudentProfile', interests: chosen }, userErrors: [] } } }
    },
  })
  await inApp(<InterestsCard />)
  expect(await screen.findByText('No topics chosen yet.')).toBeOnTheScreen()
  await fireEvent.changeText(screen.getByLabelText('Add a topic'), 'heap')
  await fireEvent.press(await screen.findByRole('button', { name: 'Follow Heaps' }))
  await waitFor(() => expect(api.calls.filter((c) => c.op === 'SetInterests').at(-1)?.variables).toEqual({ ids: [TOPIC.id] }))
  await fireEvent.press(await screen.findByRole('button', { name: 'Remove Heaps' }))
  await waitFor(() => expect(api.calls.filter((c) => c.op === 'SetInterests').at(-1)?.variables).toEqual({ ids: [] }))
  expect(await screen.findByText('No topics chosen yet.')).toBeOnTheScreen()
})
