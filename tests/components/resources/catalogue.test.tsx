import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { CatalogueScreen } from '@/features/resources/Catalogue'
import { PlaceResources } from '@/features/resources/PlaceResources'
import { ResourceScreen } from '@/features/resources/ResourceScreen'
import { createApolloClient } from '@/lib/apollo'
import { mockApi } from '../../support/api'
import { renderInApp } from '../../support/render'

/** Finding resources on the phone (lvn-backend ADR-0075): the catalogue, saving, recommending, and a group's tab. */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }))
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }))

const ravi = { __typename: 'User', id: 'u2', displayName: 'Ravi Kumar', handle: 'ravi' }
const resource = (over: Record<string, unknown> = {}) => ({
  __typename: 'Resource', id: 'r1', type: 'COURSE', title: 'Data Structures, NPTEL', description: 'Twelve weeks.', url: 'https://nptel.ac.in/courses/1', host: 'nptel.ac.in', isbn: null, author: 'IIT Delhi', coverUrl: null,
  topics: [], submittedBy: ravi, status: 'APPROVED', reason: null, decidedAt: null, createdAt: new Date().toISOString(),
  viewerCan: { __typename: 'ResourceActions', edit: false, delete: false, report: true }, saveCount: 2, viewerSaved: false, ...over,
})
const connection = (nodes: unknown[]) => ({ __typename: 'ResourceConnection', edges: nodes.map((node) => ({ __typename: 'ResourceEdge', node })), pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: null } })
const app = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)

it('filters the catalogue by type and words, and saves a resource', async () => {
  const api = mockApi({
    Resources: () => ({ data: { resources: connection([resource()]) } }),
    SaveResource: () => ({ data: { saveResource: { __typename: 'ResourcePayload', resource: { __typename: 'Resource', id: 'r1', saveCount: 3, viewerSaved: true }, userErrors: [] } } }),
  })
  await app(<CatalogueScreen />)
  expect(await screen.findByText('Data Structures, NPTEL')).toBeOnTheScreen()
  expect(screen.getByText('Saved by 2 people')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('radio', { name: 'Course' }))
  await fireEvent.changeText(screen.getByLabelText('Search resources'), 'graphs')
  await waitFor(() => expect(api.calls.filter((c) => c.op === 'Resources').at(-1)?.variables).toEqual({ filter: { type: 'COURSE', query: 'graphs' }, sort: 'POPULAR', first: 20 }))
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByText('Saved by 3 people')).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Saved' })).toBeOnTheScreen()
})

it('recommends a resource to a group with a reason', async () => {
  const api = mockApi({
    Resource: () => ({ data: { resource: resource() } }),
    Discussion: () => ({ data: { discussion: null } }),
    MyGroups: () => ({ data: { myGroups: [{ __typename: 'Group', id: 'g1', type: 'COMMUNITY', name: 'CSE 3rd Year', description: null, privacy: 'PRIVATE', joinPolicy: 'APPROVAL', memberCount: 124, viewerRole: 'MEMBER' }] } }),
    RecommendResource: () => ({ data: { recommendResource: { __typename: 'OkPayload', ok: true, userErrors: [] } } }),
  })
  await app(<ResourceScreen id="r1" />)
  await fireEvent.press(await screen.findByRole('button', { name: 'Recommend' }))
  await fireEvent.press(screen.getByRole('tab', { name: 'A group' }))
  await fireEvent.press(await screen.findByRole('radio', { name: 'CSE 3rd Year' }))
  await fireEvent.changeText(screen.getByLabelText('Why (optional)'), 'Weeks 3 and 4 are our syllabus')
  const buttons = screen.getAllByRole('button', { name: 'Recommend' })
  await fireEvent.press(buttons[buttons.length - 1]!)
  expect(await screen.findByText('Recommended to CSE 3rd Year.')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'RecommendResource')?.variables).toEqual({ input: { resourceId: 'r1', to: { groupId: 'g1' }, reason: 'Weeks 3 and 4 are our syllabus' } })
})

it('lists what members recommended to a group, with who and why', async () => {
  mockApi({
    ResourceRecommendations: () => ({ data: { resourceRecommendations: { __typename: 'ResourceRecommendationConnection', edges: [{ __typename: 'ResourceRecommendationEdge', node: { __typename: 'ResourceRecommendation', id: 'rr1', reason: 'Weeks 3 and 4 are our syllabus', createdAt: new Date().toISOString(), viewerCanRemove: true, from: ravi, resource: resource() } }], pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: null } } } }),
  })
  await app(<PlaceResources to={{ groupId: 'g1' }} />)
  expect(await screen.findByText('Ravi Kumar: Weeks 3 and 4 are our syllabus')).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Remove' })).toBeOnTheScreen()
})
