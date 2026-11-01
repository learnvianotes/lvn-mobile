import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native'
import * as ImagePicker from 'expo-image-picker'
import { StudentIdQueue, VerifyCard } from '@/features/verification/Verification'
import { signedIn, signedOut } from '@/lib/auth/session'
import { createApolloClient } from '@/lib/apollo'
import { mockApi, session, viewer } from '../../support/api'
import { renderInApp } from '../../support/render'
import { fileBlob } from '../../support/blob'

/** A college ID card on the phone: camera or gallery, then the queue an admin, manager or teacher reviews. */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }))

const none = { userErrors: [] }
const inApollo = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)
const card = (over: Record<string, unknown> = {}) => ({ __typename: 'StudentIdVerificationRequest', id: 'c1', status: 'PENDING', reason: null, createdAt: new Date().toISOString(), decidedAt: null, requester: { __typename: 'User', id: 's1', displayName: 'Ravi Kumar', handle: 'ravi' }, ...over })

beforeEach(async () => {
  jest.clearAllMocks()
  await signedOut()
})

afterAll(async () => {
  await signedOut()
})

function withFileFetch(putOk: boolean) {
  const graphql = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.startsWith('file://')) return { blob: async () => fileBlob(2048) } as unknown as Response
    if (url === 'https://storage.test/put') return { ok: putOk } as Response
    return graphql(input, init)
  }) as typeof fetch
}

it('hides the college ID when the option is off, for a minor, and while uploads are off', async () => {
  mockApi({
    MyVerificationRequests: () => ({ data: { myVerificationRequests: [] } }),
    StudentIdVerificationEnabled: () => ({ data: { studentIdVerificationEnabled: false } }),
  })
  await inApollo(<VerifyCard restrictedMinor={false} />)
  expect(await screen.findByRole('button', { name: 'Ask a teacher' })).toBeOnTheScreen()
  expect(screen.queryByRole('button', { name: 'Send your college ID card' })).toBeNull()

  mockApi({
    MyVerificationRequests: () => ({ data: { myVerificationRequests: [] } }),
    StudentIdVerificationEnabled: () => ({ data: { studentIdVerificationEnabled: true } }),
  })
  await inApollo(<VerifyCard restrictedMinor />)
  expect(await screen.findByRole('button', { name: 'Ask a teacher' })).toBeOnTheScreen()
  expect(screen.queryByRole('button', { name: 'Send your college ID card' })).toBeNull()

  mockApi({
    MyVerificationRequests: () => ({ data: { myVerificationRequests: [] } }),
    UploadsEnabled: () => ({ data: { uploadsEnabled: false } }),
    StudentIdVerificationEnabled: () => ({ data: { studentIdVerificationEnabled: true } }),
  })
  await inApollo(<VerifyCard restrictedMinor={false} />)
  expect(await screen.findByRole('button', { name: 'Ask a teacher' })).toBeOnTheScreen()
  expect(screen.queryByRole('button', { name: 'Send your college ID card' })).toBeNull()
})

it('sends a college ID from the camera, then withdraws it while it waits', async () => {
  let mine: unknown = null
  jest.mocked(ImagePicker.launchCameraAsync).mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///id.jpg', fileName: 'id.jpg', mimeType: 'image/jpeg', fileSize: 2048, width: 100, height: 80, type: 'image' }] } as never)
  const api = mockApi({
    MyVerificationRequests: () => ({ data: { myVerificationRequests: [] } }),
    StudentIdVerificationEnabled: () => ({ data: { studentIdVerificationEnabled: true } }),
    MyStudentIdVerification: () => ({ data: { myStudentIdVerification: mine } }),
    CreateStudentIdUploadIntent: () => ({ data: { createStudentIdUploadIntent: { __typename: 'StudentIdUploadPayload', upload: { __typename: 'StudentIdUpload', fileId: 'f1', uploadUrl: 'https://storage.test/put', expiresAt: new Date().toISOString(), uploadHeaders: [] }, ...none } } }),
    SubmitStudentIdVerification: () => ((mine = card()), { data: { submitStudentIdVerification: { __typename: 'StudentIdVerificationPayload', request: mine, ...none } } }),
    WithdrawStudentIdVerification: () => ((mine = null), { data: { withdrawStudentIdVerification: { __typename: 'OkPayload', ok: true, ...none } } }),
  })
  withFileFetch(true)
  await inApollo(<VerifyCard restrictedMinor={false} />)
  await fireEvent.press(await screen.findByRole('button', { name: 'Send your college ID card' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Take a photo' }))
  expect(await screen.findByText('id.jpg')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Send to an admin' }))
  expect(await screen.findByText('An admin is checking your college ID card.')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'CreateStudentIdUploadIntent')?.variables).toEqual({ input: { fileName: 'id.jpg', mimeType: 'image/jpeg', sizeBytes: 2048 } })
  expect(api.calls.find((c) => c.op === 'SubmitStudentIdVerification')?.variables).toEqual({ input: { fileId: 'f1' } })
  await fireEvent.press(screen.getByRole('button', { name: 'Withdraw the college ID request' }))
  expect(await screen.findByRole('button', { name: 'Send your college ID card' })).toBeOnTheScreen()
})

it('reports an upload failure with platform MOBILE and no file name or email', async () => {
  await signedIn(session(viewer({ email: 'ravi@college.edu' })))
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///ravi-id.jpg', fileName: 'ravi-id.jpg', mimeType: 'image/jpeg', fileSize: 2048, width: 40, height: 40, type: 'image' }] } as never)
  const api = mockApi({
    MyVerificationRequests: () => ({ data: { myVerificationRequests: [] } }),
    StudentIdVerificationEnabled: () => ({ data: { studentIdVerificationEnabled: true } }),
    MyStudentIdVerification: () => ({ data: { myStudentIdVerification: null } }),
    CreateStudentIdUploadIntent: () => ({ data: { createStudentIdUploadIntent: { __typename: 'StudentIdUploadPayload', upload: { __typename: 'StudentIdUpload', fileId: 'f1', uploadUrl: 'https://storage.test/put', expiresAt: new Date().toISOString(), uploadHeaders: [] }, ...none } } }),
    IngestAnalytics: () => ({ data: { ingestAnalytics: { __typename: 'OkPayload', ok: true, userErrors: [] } } }),
  })
  withFileFetch(false)
  await inApollo(<VerifyCard restrictedMinor={false} />)
  await fireEvent.press(await screen.findByRole('button', { name: 'Send your college ID card' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Choose a photo' }))
  await fireEvent.press(await screen.findByRole('button', { name: 'Send to an admin' }))
  expect(await screen.findByText('The file could not be uploaded. Try again.')).toBeOnTheScreen()
  await waitFor(() => expect(api.calls.some((c) => c.op === 'IngestAnalytics')).toBe(true))
  const sent = api.calls.find((c) => c.op === 'IngestAnalytics')?.variables as { input: { errors: { code: string; message: string; platform: string }[] } }
  expect(sent.input.errors[0]).toMatchObject({ code: 'upload', platform: 'MOBILE' })
  const body = JSON.stringify(sent)
  expect(body).not.toContain('ravi-id.jpg')
  expect(body).not.toContain('ravi@college.edu')
  expect(body).not.toContain(viewer().id)
})

it('shows a refused college ID, and an accepted one', async () => {
  mockApi({
    MyVerificationRequests: () => ({ data: { myVerificationRequests: [] } }),
    StudentIdVerificationEnabled: () => ({ data: { studentIdVerificationEnabled: true } }),
    MyStudentIdVerification: () => ({ data: { myStudentIdVerification: card({ status: 'REJECTED', reason: 'The photo is blurry.' }) } }),
  })
  await inApollo(<VerifyCard restrictedMinor={false} />)
  expect(await screen.findByText('Your college ID was not accepted: The photo is blurry.')).toBeOnTheScreen()

  mockApi({
    MyVerificationRequests: () => ({ data: { myVerificationRequests: [] } }),
    StudentIdVerificationEnabled: () => ({ data: { studentIdVerificationEnabled: true } }),
    MyStudentIdVerification: () => ({ data: { myStudentIdVerification: card({ status: 'APPROVED' }) } }),
  })
  await inApollo(<VerifyCard restrictedMinor={false} />)
  expect(await screen.findByText('Your college ID was accepted.')).toBeOnTheScreen()
})

it('lets a teacher open a college ID and approve it, and a student cannot see the queue', async () => {
  const person = { __typename: 'User', id: 's1', displayName: 'Ravi Kumar', handle: 'ravi', email: null, institution: { __typename: 'Institution', name: 'City College' }, profile: { __typename: 'StudentProfile', department: 'CSE' } }
  const item = { ...card(), aiCheck: { __typename: 'IdCardCheck', verdict: 'MATCH', confidence: 0.91, reason: 'Name and college agree.', checkedAt: new Date().toISOString(), extracted: { __typename: 'IdCardFields', name: 'Ravi Kumar', institution: 'City College', idNumber: '19', validUntil: null } }, requester: person }
  let waiting = [item]
  const api = mockApi({
    Viewer: () => ({ data: { viewer: viewer({ globalRole: 'TEACHER' }) } }),
    StudentIdVerificationQueue: () => ({ data: { studentIdVerificationQueue: waiting } }),
    StudentIdCardUrl: () => ({ data: { studentIdCardUrl: { __typename: 'SignedUrl', url: 'https://storage.test/card', expiresAt: new Date().toISOString() } } }),
    ReviewStudentIdVerification: () => ((waiting = []), { data: { reviewStudentIdVerification: { __typename: 'StudentIdVerificationPayload', request: { __typename: 'StudentIdVerificationRequest', id: 'c1', status: 'APPROVED' }, ...none } } }),
  })
  await inApollo(<StudentIdQueue />)
  const row = await screen.findByLabelText('College ID from Ravi Kumar')
  expect(within(row).getByText('Match')).toBeOnTheScreen()
  expect(within(row).getByText(/91% confidence/)).toBeOnTheScreen()
  expect(within(row).getAllByText(/matches the profile/).length).toBeGreaterThan(0)
  await fireEvent.press(within(row).getByRole('button', { name: 'View college ID card for Ravi Kumar' }))
  expect(await screen.findByLabelText('College ID card for Ravi Kumar')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'StudentIdCardUrl')?.variables).toEqual({ requestId: 'c1' })
  await fireEvent.press(within(row).getByRole('button', { name: 'Reject' }))
  expect(within(row).getByText('Tell the student why, so they can try again.')).toBeOnTheScreen()
  await fireEvent.press(within(row).getByRole('button', { name: 'Approve' }))
  await waitFor(() => expect(screen.queryByLabelText('College ID from Ravi Kumar')).toBeNull())

  mockApi({ Viewer: () => ({ data: { viewer: viewer({ globalRole: 'STUDENT' }) } }) })
  await inApollo(<StudentIdQueue />)
  expect(await screen.findByText('This is for platform admins, managers and teachers.')).toBeOnTheScreen()
})

it('a manager sees the college ID queue', async () => {
  mockApi({
    Viewer: () => ({ data: { viewer: viewer({ globalRole: 'MANAGER' }) } }),
    StudentIdVerificationQueue: () => ({ data: { studentIdVerificationQueue: [] } }),
  })
  await inApollo(<StudentIdQueue />)
  expect(await screen.findByText('No college ID cards waiting.')).toBeOnTheScreen()
})
