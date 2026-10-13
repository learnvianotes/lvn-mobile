import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import { ExploreScreen } from '@/features/explore/ExploreScreen'
import { createApolloClient } from '@/lib/apollo'
import { mockApi } from '../../support/api'
import { renderInApp } from '../../support/render'

/**
 * Explore on the phone (lvn-backend ADR-0056): notes, people, groups, classes and topics; kind and source chips; a
 * topic lists its notes; more results; recent searches kept on the phone.
 */
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))
const mockStore = new Map<string, string>()
jest.mock('@/features/notes/store/db', () => ({
  getValue: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setValue: jest.fn(async (key: string, value: string | null) => void (value === null ? mockStore.delete(key) : mockStore.set(key, value))),
}))

const MEERA = '01920000-0000-7000-8000-0000000000e1'
const owner = { __typename: 'User', id: MEERA, displayName: 'Meera Iyer' }
const hit = (id: string, title: string, kind = 'NOTE', snippet = 'Always settle the closest vertex; heaps make it fast.') => ({ __typename: 'NoteSearchHit', snippet, note: { __typename: 'Note', id, title, kind, visibility: 'PUBLIC', owner } })
const topic = { __typename: 'Topic', id: 't1', title: 'Shortest paths', subject: { __typename: 'Subject', id: 's1', title: 'Algorithms' } }
const results = (over: Record<string, unknown> = {}) => ({ data: { search: { __typename: 'SearchResults', resources: [], notes: [hit('n1', "Dijkstra's algorithm")], notesCursor: null, people: [], topics: [], groups: [], classrooms: [], ...over } } })
const inApollo = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)
const SEARCH = 'Search notes, people, groups and topics'

beforeEach(() => {
  mockStore.clear()
  jest.clearAllMocks()
})

it('finds people, groups, classes and notes, and remembers what was searched', async () => {
  mockApi({
    Search: () =>
      results({
        people: [{ __typename: 'User', id: MEERA, handle: 'meera', displayName: 'Meera Iyer', globalRole: 'TEACHER' }],
        groups: [{ __typename: 'Group', id: 'g1', name: 'Graph theory circle', type: 'COMMUNITY', privacy: 'PUBLIC', memberCount: 12 }],
        classrooms: [{ __typename: 'Classroom', id: 'c1', name: 'Graph algorithms, section B', memberCount: 1 }],
      }),
  })
  await inApollo(<ExploreScreen />)
  expect(screen.getByText(/Type to search notes, people, groups and topics/)).toBeOnTheScreen()
  await fireEvent.changeText(screen.getByLabelText(SEARCH), 'graph')
  expect(await screen.findByLabelText('Meera Iyer, @meera')).toBeOnTheScreen()
  expect(screen.getByLabelText('Graph algorithms, section B, Class, 1 member')).toBeOnTheScreen()
  expect(screen.getByText('heaps')).toBeOnTheScreen()
  await fireEvent.press(screen.getByLabelText('Graph theory circle, Group, 12 members'))
  expect(router.push).toHaveBeenCalledWith('/groups/g1')
  await waitFor(() => expect(mockStore.get('search.recent')).toBe(JSON.stringify(['graph'])))
})

it('shows recent searches when the box is empty: again, remove one, clear all', async () => {
  mockStore.set('search.recent', JSON.stringify(['dijkstra', 'heaps', 'tries']))
  const api = mockApi({ Search: () => results() })
  await inApollo(<ExploreScreen />)
  await fireEvent.press(await screen.findByLabelText('Remove “heaps” from recent searches'))
  await waitFor(() => expect(screen.queryByLabelText('Search for “heaps” again')).toBeNull())
  expect(JSON.parse(mockStore.get('search.recent')!)).toEqual(['dijkstra', 'tries'])
  await fireEvent.press(screen.getByLabelText('Search for “dijkstra” again'))
  expect(await screen.findByLabelText("Dijkstra's algorithm")).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'Search')?.variables).toEqual({ query: 'dijkstra' })
  await fireEvent.press(screen.getByLabelText('Clear the search'))
  await fireEvent.press(await screen.findByLabelText('Clear recent searches'))
  await waitFor(() => expect(mockStore.has('search.recent')).toBe(false))
})

it('narrows notes by kind and source, and a topic lists its notes newest first', async () => {
  const api = mockApi({ Search: (v) => (v.filters ? results({ notes: [hit('n2', 'Graph visualiser', 'PROJECT', 'A tool that draws paths.')] }) : results({ topics: [topic] })) })
  await inApollo(<ExploreScreen />)
  await fireEvent.changeText(screen.getByLabelText(SEARCH), 'paths')
  await fireEvent.press(await screen.findByLabelText('Projects'))
  await fireEvent.press(screen.getByLabelText('Shared with me'))
  expect(await screen.findByLabelText('Graph visualiser')).toBeOnTheScreen()
  expect(screen.getByLabelText('Projects')).toBeSelected()
  await waitFor(() => expect(api.calls.filter((c) => c.op === 'Search').at(-1)?.variables).toEqual({ query: 'paths', filters: { kinds: ['PROJECT'], sources: ['SHARED'], topicId: null } }))
  await fireEvent.press(screen.getByLabelText('Projects'))
  await fireEvent.press(screen.getByLabelText('Shared with me'))
  await fireEvent.press(await screen.findByLabelText('Notes about Shortest paths'))
  expect(await screen.findByText('Notes, newest first')).toBeOnTheScreen()
  await waitFor(() => expect(api.calls.filter((c) => c.op === 'Search').at(-1)?.variables).toEqual({ query: '', filters: { kinds: null, sources: null, topicId: 't1' } }))
  await fireEvent.press(screen.getByLabelText('About Shortest paths'))
  expect(await screen.findByText(/Type to search notes, people, groups and topics/)).toBeOnTheScreen()
})

it('brings more notes of the same search', async () => {
  const api = mockApi({ Search: (v) => (v.after ? results({ notes: [hit('n2', 'Bellman-Ford', 'NOTE', 'Negative edges.')] }) : results({ notesCursor: 'c2' })) })
  await inApollo(<ExploreScreen />)
  await fireEvent.changeText(screen.getByLabelText(SEARCH), 'paths')
  await fireEvent.press(await screen.findByLabelText('More results'))
  expect(await screen.findByLabelText('Bellman-Ford')).toBeOnTheScreen()
  expect(screen.getByLabelText("Dijkstra's algorithm")).toBeOnTheScreen()
  expect(screen.queryByLabelText('More results')).toBeNull()
  expect(api.calls.filter((c) => c.op === 'Search').at(-1)?.variables).toEqual({ query: 'paths', after: 'c2' })
})
