import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen } from '@testing-library/react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SubjectsScreen } from '@/features/subjects/SubjectsScreen'
import { createApolloClient } from '@/lib/apollo'
import { mockApi } from '../../support/api'
import { renderInApp } from '../../support/render'

/** Subjects on the phone (owner, 2026-10-14: the app's own catalogue, not /core): subjects, topics, a topic's notes. */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() }, useLocalSearchParams: jest.fn(() => ({})) }))

const subjects = [
  { __typename: 'Subject', id: 's1', slug: 'dsa', title: 'Data Structures and Algorithms', topics: [{ __typename: 'Topic', id: 't1', slug: 'graphs', title: 'Graphs', children: [{ __typename: 'Topic', id: 't2', slug: 'shortest-paths', title: 'Shortest paths' }] }] },
  { __typename: 'Subject', id: 's2', slug: 'os', title: 'Operating Systems', topics: [] },
]
const inApollo = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)

it('lists subjects; a subject shows its topics, and a topic or subtopic opens its notes in Explore', async () => {
  mockApi({ Subjects: () => ({ data: { subjects } }) })
  const view = await inApollo(<SubjectsScreen />)
  expect(await screen.findByText('Operating Systems')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('link', { name: 'Data Structures and Algorithms' }))
  expect(router.push).toHaveBeenLastCalledWith('/subjects/dsa')
  await view.unmount()
  jest.mocked(useLocalSearchParams).mockReturnValue({ slug: 'dsa' })
  await inApollo(<SubjectsScreen />)
  await fireEvent.press(await screen.findByRole('link', { name: 'Notes on Graphs' }))
  expect(router.push).toHaveBeenLastCalledWith({ pathname: '/explore', params: { topic: 't1', topicTitle: 'Graphs' } })
  await fireEvent.press(screen.getByRole('link', { name: 'Notes on Shortest paths' }))
  expect(router.push).toHaveBeenLastCalledWith({ pathname: '/explore', params: { topic: 't2', topicTitle: 'Shortest paths' } })
})
