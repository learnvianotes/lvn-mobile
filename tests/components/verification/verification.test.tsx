import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native'
import * as DocumentPicker from 'expo-document-picker'
import * as WebBrowser from 'expo-web-browser'
import { ReviewRequests, VerifyCard } from '@/features/verification/Verification'
import { createApolloClient } from '@/lib/apollo'
import { mockApi } from '../../support/api'
import { renderInApp } from '../../support/render'
import { fileBlob } from '../../support/blob'

/**
 * Verifying without a college email on the phone (lvn-backend ADR-0019): ask a teacher, send proof of study, withdraw;
 * teachers and platform admins answer.
 */
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(async () => ({ type: 'opened' })) }))

const person = (id: string, displayName: string, handle: string) => ({ __typename: 'User', id, displayName, handle })
const meera = person('t1', 'Meera Iyer', 'meera')
const ravi = person('s1', 'Ravi Kumar', 'ravi')
const request = (over: Record<string, unknown> = {}) => ({ __typename: 'VerificationRequest', id: 'r1', purpose: 'ACCOUNT', institution: null, subjects: null, method: 'TEACHER', status: 'PENDING', message: null, reason: null, createdAt: new Date().toISOString(), decidedAt: null, requester: ravi, teacher: meera, ...over })
const none = { userErrors: [] }
const inApollo = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)

beforeEach(() => jest.clearAllMocks())

it('asks a verified teacher to vouch, then can withdraw while it waits', async () => {
  let mine: unknown[] = []
  const api = mockApi({
    MyVerificationRequests: () => ({ data: { myVerificationRequests: mine } }),
    FindTeachers: () => ({ data: { search: { __typename: 'SearchResults', people: [{ ...meera, globalRole: 'TEACHER' }, { ...person('x', 'Meera Student', 'meeras'), globalRole: 'STUDENT' }] } } }),
    RequestTeacherVerification: () => ((mine = [request()]), { data: { requestTeacherVerification: { __typename: 'VerificationRequestPayload', request: mine[0], ...none } } }),
    WithdrawVerificationRequest: () => ((mine = []), { data: { withdrawVerificationRequest: { __typename: 'OkPayload', ok: true, ...none } } }),
  })
  await inApollo(<VerifyCard restrictedMinor={false} />)
  await fireEvent.press(await screen.findByRole('button', { name: 'Ask a teacher' }))
  await fireEvent.changeText(screen.getByLabelText('Find your teacher'), 'meera')
  await fireEvent.press(await screen.findByRole('button', { name: 'Meera Iyer @meera' }))
  expect(screen.queryByRole('button', { name: 'Meera Student @meeras' })).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: 'Send request' }))
  expect(await screen.findByText('Waiting for Meera Iyer to vouch for you.')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'RequestTeacherVerification')?.variables).toEqual({ input: { teacherId: 't1', message: null } })
  await fireEvent.press(screen.getByRole('button', { name: 'Withdraw the request' }))
  expect(await screen.findByRole('button', { name: 'Ask a teacher' })).toBeOnTheScreen()
})

it('sends proof of study from the phone’s files; a minor is offered a teacher only', async () => {
  let mine: unknown[] = [request({ method: 'DOCUMENTS', status: 'REJECTED', teacher: null, reason: 'Blurry.' })]
  jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///id.jpg', name: 'id.jpg', size: 2048, mimeType: 'image/jpeg' }] } as never)
  const api = mockApi({
    MyVerificationRequests: () => ({ data: { myVerificationRequests: mine } }),
    CreateNoteUpload: () => ({ data: { createUploadIntent: { __typename: 'UploadIntentPayload', intent: { __typename: 'UploadIntent', fileId: 'f1', uploadUrl: 'https://storage.test/put', uploadHeaders: [] }, ...none } } }),
    CompleteNoteUpload: () => ({ data: { completeUpload: { __typename: 'OkPayload', ok: true, ...none } } }),
    RequestDocumentVerification: () => ((mine = [request({ method: 'DOCUMENTS', teacher: null }), ...mine]), { data: { requestDocumentVerification: { __typename: 'VerificationRequestPayload', request: mine[0], ...none } } }),
  })
  const graphql = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.startsWith('file://')) return { blob: async () => fileBlob(2048) } as unknown as Response
    if (url === 'https://storage.test/put') return { ok: true } as Response
    return graphql(input, init)
  }) as typeof fetch
  await inApollo(<VerifyCard restrictedMinor={false} />)
  expect(await screen.findByText('Your last request was not accepted: Blurry.')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Send proof of study' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Choose files' }))
  expect(await screen.findByText('id.jpg')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Send request' }))
  expect(await screen.findByText('Our team is checking your documents.')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'CreateNoteUpload')?.variables).toEqual({ input: { fileName: 'id.jpg', mimeType: 'image/jpeg', sizeBytes: 2048, purpose: 'VERIFICATION_DOCUMENT' } })
  expect(api.calls.find((c) => c.op === 'RequestDocumentVerification')?.variables).toEqual({ input: { fileIds: ['f1'], message: null } })

  mockApi({ MyVerificationRequests: () => ({ data: { myVerificationRequests: [] } }) })
  await inApollo(<VerifyCard restrictedMinor />)
  expect(await screen.findByRole('button', { name: 'Ask a teacher' })).toBeOnTheScreen()
  expect(screen.queryByRole('button', { name: 'Send proof of study' })).toBeNull()
})

it('a teacher verifies a student who asked, and must say why to decline', async () => {
  let waiting = [request({ message: 'Section B' }), request({ id: 'r2', requester: person('s2', 'Dev Patel', 'dev') })]
  const api = mockApi({
    VerificationRequestsToReview: () => ({ data: { verificationRequestsToReview: waiting.map((r) => ({ ...r, documents: [] })) } }),
    ReviewVerificationRequest: (v) => ((waiting = waiting.filter((r) => r.id !== (v.input as { requestId: string }).requestId)), { data: { reviewVerificationRequest: { __typename: 'VerificationRequestPayload', request: null, ...none } } }),
  })
  await inApollo(<ReviewRequests />)
  const raviCard = await screen.findByLabelText('Request from Ravi Kumar')
  expect(within(raviCard).getByText('Section B')).toBeOnTheScreen()
  await fireEvent.press(within(raviCard).getByRole('button', { name: 'Verify' }))
  await waitFor(() => expect(screen.queryByLabelText('Request from Ravi Kumar')).toBeNull())
  const dev = screen.getByLabelText('Request from Dev Patel')
  await fireEvent.press(within(dev).getByRole('button', { name: 'Decline' }))
  expect(within(dev).getByText('Tell the student why, so they can try again.')).toBeOnTheScreen()
  await fireEvent.changeText(within(dev).getByLabelText('Reason (needed to decline; the student reads it)'), 'I do not teach you.')
  await fireEvent.press(within(dev).getByRole('button', { name: 'Decline' }))
  await waitFor(() => expect(api.calls.filter((c) => c.op === 'ReviewVerificationRequest').at(-1)?.variables).toEqual({ input: { requestId: 'r2', approve: false, reason: 'I do not teach you.' } }))
})

it('platform admins open proof of study through a recorded link', async () => {
  const docs = { ...request({ method: 'DOCUMENTS', teacher: null }), documents: [{ __typename: 'VerificationDocument', fileId: 'f1', fileName: 'id.jpg', mimeType: 'image/jpeg', sizeBytes: 2048 }] }
  const api = mockApi({
    VerificationRequestsToReview: () => ({ data: { verificationRequestsToReview: [docs] } }),
    VerificationDocumentUrl: () => ({ data: { verificationDocumentUrl: { __typename: 'SignedUrl', url: 'https://storage.test/doc', expiresAt: new Date().toISOString() } } }),
  })
  await inApollo(<ReviewRequests admin />)
  await fireEvent.press(await screen.findByRole('button', { name: 'Open id.jpg' }))
  await waitFor(() => expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://storage.test/doc'))
  expect(api.calls.find((c) => c.op === 'VerificationDocumentUrl')?.variables).toEqual({ requestId: 'r1', fileId: 'f1' })
})
