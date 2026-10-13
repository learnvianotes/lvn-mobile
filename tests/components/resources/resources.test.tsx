import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import { ModerationQueue } from '@/features/moderation/ModerationQueue'
import { MyResourcesScreen } from '@/features/resources/MyResourcesScreen'
import { ResourceFormScreen } from '@/features/resources/ResourceFormScreen'
import { ResourceScreen } from '@/features/resources/ResourceScreen'
import { createApolloClient } from '@/lib/apollo'
import { mockApi, viewer } from '../../support/api'
import { renderInApp } from '../../support/render'

/** Resources on the phone (lvn-backend ADR-0074): add one from a link, see its state, and moderators decide. */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }))
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }))

const ID = 'r1'
const me = { __typename: 'User', id: 'u1', displayName: 'Asha Rao', handle: 'asharao' }
const resource = (over: Record<string, unknown> = {}) => ({
  __typename: 'Resource', id: ID, type: 'BOOK', title: 'Clean Code', description: 'Even bad code can function.', url: 'https://books.example.com/clean-code', host: 'books.example.com', isbn: '9780132350884', author: 'Robert C. Martin', coverUrl: null,
  topics: [{ __typename: 'Topic', id: 't1', title: 'Arrays' }], submittedBy: me, status: 'PENDING', reason: null, decidedAt: null, createdAt: new Date().toISOString(),
  viewerCan: { __typename: 'ResourceActions', edit: true, delete: true, report: false }, ...over,
})
const app = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)

it('fills the form from a link, takes topics from the list, and sends it to moderators', async () => {
  const api = mockApi({
    Viewer: () => ({ data: { viewer: viewer() } }),
    ResourcePreview: () => ({ data: { resourcePreview: { __typename: 'ResourcePreview', url: 'https://books.example.com/clean-code', title: 'Clean Code', description: 'Even bad code can function.', author: 'Robert C. Martin', isbn: '9780132350884', type: 'BOOK', siteName: 'Example Books', imageUrl: null, found: true, existing: null } } }),
    ResourceTopicOptions: () => ({ data: { resourceTopicOptions: [{ __typename: 'ExamTopicOption', id: 't1', title: 'Arrays', subjectTitle: 'Data Structures' }] } }),
    SubmitResource: () => ({ data: { submitResource: { __typename: 'ResourcePayload', resource: resource(), userErrors: [] } } }),
    MyResources: () => ({ data: { myResources: [resource()] } }),
  })
  await app(<ResourceFormScreen />)
  await fireEvent.changeText(screen.getByLabelText('Link'), 'https://books.example.com/clean-code?utm_source=x')
  await fireEvent.press(screen.getByRole('button', { name: 'Fill in from the page' }))
  await waitFor(() => expect(screen.getByLabelText('Title').props.value).toBe('Clean Code'))
  expect(screen.getByRole('radio', { name: 'Book' }).props.accessibilityState).toMatchObject({ checked: true })
  await fireEvent.changeText(screen.getByLabelText('Find a topic'), 'arr')
  await fireEvent.press(await screen.findByRole('button', { name: 'Add Arrays' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Send to moderators' }))
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith(`/resources/${ID}`))
  expect(api.calls.find((c) => c.op === 'SubmitResource')?.variables).toEqual({ input: { type: 'BOOK', title: 'Clean Code', url: 'https://books.example.com/clean-code', isbn: '9780132350884', author: 'Robert C. Martin', description: 'Even bad code can function.', topicIds: ['t1'], coverFileId: null, imageUrl: null } })
})

it('shows a rejected resource with why, and offers to edit and send it again', async () => {
  mockApi({ Resource: () => ({ data: { resource: resource({ status: 'REJECTED', reason: 'A shop, not a resource.' }) } }) })
  await app(<ResourceScreen id={ID} />)
  expect(await screen.findByText('Not approved')).toBeOnTheScreen()
  expect(screen.getByText('Why moderators did not approve it: A shop, not a resource.')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Edit and send again' }))
  expect(router.push).toHaveBeenCalledWith(`/resources/${ID}/edit`)
})

it('lists one’s resources with their state', async () => {
  mockApi({ MyResources: () => ({ data: { myResources: [resource({ status: 'APPROVED' }), resource({ id: 'r2', title: 'A sales page', status: 'REJECTED', reason: 'A shop, not a resource.' })] } }) })
  await app(<MyResourcesScreen />)
  expect(await screen.findByText('In the catalogue')).toBeOnTheScreen()
  expect(screen.getByText('Not approved')).toBeOnTheScreen()
  expect(screen.getByText('A shop, not a resource.')).toBeOnTheScreen()
})

it('lets a platform admin approve a new resource, and reject one only with a reason', async () => {
  const at = new Date().toISOString()
  const kase = (id: string, title: string) => ({
    __typename: 'ModerationCase', resource: resource({ id, title }), suspendedUntil: null, removedGroup: null, entityType: 'RESOURCE', entityId: id, scope: 'PLATFORM', scopeId: null, openedAt: at, note: null, user: null, content: null, group: null, appeal: null,
    reports: [{ __typename: 'ModerationReport', reason: 'OTHER', details: 'New resource, waiting for approval.', createdAt: at, reporter: null }],
  })
  const api = mockApi({
    ModerationQueue: () => ({ data: { moderationQueue: { __typename: 'ModerationCaseConnection', edges: [{ __typename: 'ModerationCaseEdge', node: kase('r1', 'Clean Code') }], pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: null } } } }),
    ModerateContent: () => ({ data: { moderateContent: { __typename: 'OkPayload', ok: true, userErrors: [] } } }),
  })
  await app(<ModerationQueue />)
  expect(await screen.findByText('Clean Code')).toBeOnTheScreen()
  expect(screen.getByText('https://books.example.com/clean-code')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Reject' }))
  expect(await screen.findByText('Write a reason first: the author is told.')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Approve' }))
  await waitFor(() => expect(api.calls.find((c) => c.op === 'ModerateContent')?.variables).toEqual({ input: { entityType: 'RESOURCE', entityId: 'r1', action: 'APPROVE', reason: null } }))
})
