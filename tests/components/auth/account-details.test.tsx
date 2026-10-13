import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import * as DocumentPicker from 'expo-document-picker'
import { router, usePathname } from 'expo-router'
import { InstitutionalEmailCard, LegacyDataCard, StudyDetailsCard } from '@/features/auth/AccountDetails'
import { TermsGate } from '@/features/auth/TermsGate'
import { ImportCard } from '@/features/data/ImportCard'
import { createApolloClient } from '@/lib/apollo'
import { mockApi, viewer } from '../../support/api'
import { renderInApp } from '../../support/render'
import { fileBlob } from '../../support/blob'

/**
 * The account on the phone (lvn-backend P3n): new terms to accept, study details, a college email, old-site data and
 * importing notes — all of it here now, not only on the web.
 */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn() }, usePathname: jest.fn(() => '/') }))
jest.mock('@/features/notes/sync/engine', () => ({ syncNow: jest.fn(async () => {}) }))

const ME = viewer().id
const details = (over: Record<string, unknown> = {}) => ({ data: { viewer: { __typename: 'User', id: ME, profile: { __typename: 'StudentProfile', department: 'CSE', yearOfStudy: 'YEAR_2', showOnProfile: false }, legacyImport: null, ...over } } })
const ok = (name: string) => ({ data: { [name]: { __typename: 'OkPayload', ok: true, userErrors: [] } } })
const inApollo = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(usePathname).mockReturnValue('/')
})

it('new terms wait for acceptance everywhere but the Profile tab', async () => {
  let accepted = false
  const api = mockApi({
    TermsStatus: () => ({ data: { termsVersion: '2026-11-01', viewer: { __typename: 'User', id: ME, termsAccepted: accepted } } }),
    AcceptTerms: () => ((accepted = true), ok('acceptTerms')),
  })
  await inApollo(<TermsGate />)
  expect(await screen.findByRole('header', { name: 'We have updated our terms' })).toBeOnTheScreen()
  expect(screen.getByRole('link', { name: 'Privacy Policy' })).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('link', { name: 'Not now — sign out' }))
  expect(router.navigate).toHaveBeenCalledWith('/profile')
  await fireEvent.press(screen.getByRole('button', { name: 'Accept and continue' }))
  await waitFor(() => expect(screen.queryByRole('header', { name: 'We have updated our terms' })).toBeNull())
  expect(api.calls.find((c) => c.op === 'AcceptTerms')?.variables).toEqual({ version: '2026-11-01' })
})

it('the Profile tab stays open with new terms, so people who do not agree can sign out', async () => {
  jest.mocked(usePathname).mockReturnValue('/profile')
  mockApi({ TermsStatus: () => ({ data: { termsVersion: '2026-11-01', viewer: { __typename: 'User', id: ME, termsAccepted: false } } }) })
  await inApollo(<TermsGate />)
  await waitFor(() => expect(screen.queryByRole('header', { name: 'We have updated our terms' })).toBeNull())
})

it('saves study details', async () => {
  const api = mockApi({
    PhoneAccountDetails: () => details(),
    UpdateProfile: () => ({ data: { updateProfile: { __typename: 'UpdateProfilePayload', profile: { __typename: 'StudentProfile', department: 'ECE', yearOfStudy: 'YEAR_3', showOnProfile: true }, userErrors: [] } } }),
  })
  await inApollo(<StudyDetailsCard />)
  expect(await screen.findByDisplayValue('CSE')).toBeOnTheScreen()
  await fireEvent.changeText(screen.getByLabelText('Department'), 'ECE')
  await fireEvent.press(screen.getByRole('radio', { name: '3rd year' }))
  await fireEvent(screen.getByLabelText('Show department and year on my profile'), 'valueChange', true)
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByText('Saved')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'UpdateProfile')?.variables).toEqual({ input: { department: 'ECE', yearOfStudy: 'YEAR_3', showOnProfile: true } })
})

it('adds a college email, which sends a code to enter', async () => {
  const api = mockApi({ SetInstitutionalEmail: () => ok('setInstitutionalEmail'), Viewer: () => ({ data: { viewer: viewer() } }) })
  await inApollo(<InstitutionalEmailCard viewer={viewer({ institutionalEmailStatus: 'NONE' }) as never} />)
  await fireEvent.press(screen.getByRole('button', { name: 'Add' }))
  await fireEvent.changeText(screen.getByLabelText('Email'), ' ravi@college.edu ')
  await fireEvent.press(screen.getByRole('button', { name: 'Send the code' }))
  await waitFor(() => expect(api.calls.find((c) => c.op === 'SetInstitutionalEmail')?.variables).toEqual({ email: 'ravi@college.edu' }))

  await inApollo(<InstitutionalEmailCard viewer={viewer({ institutionalEmailStatus: 'CODE_SENT', institutionalEmail: 'ravi@college.edu' }) as never} />)
  await fireEvent.press(screen.getByRole('button', { name: 'Enter the code' }))
  expect(router.push).toHaveBeenCalledWith('/verify')
})

it('brings the old site’s progress over, or removes it', async () => {
  let status = 'AVAILABLE'
  const api = mockApi({
    PhoneAccountDetails: () => details({ legacyImport: { __typename: 'LegacyImport', status, claimedAt: null, counts: { __typename: 'LegacyCounts', notes: 3, completedTopics: 12, markedProblems: 40, studyDays: 9, studyMinutes: 300 } } }),
    ClaimLegacyData: () => ((status = 'CLAIMED'), ok('claimLegacyData')),
    DeclineLegacyData: () => ((status = 'DECLINED'), ok('declineLegacyData')),
  })
  await inApollo(<LegacyDataCard />)
  expect(await screen.findByText(/12 topics read, 40 problems marked, 9 study days/)).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Bring it over' }))
  expect(await screen.findByText('Your old progress is here.')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Remove it' }))
  expect(await screen.findByText('Old-site data removed.')).toBeOnTheScreen()
  expect(api.ops()).toEqual(expect.arrayContaining(['ClaimLegacyData', 'DeclineLegacyData']))
})

it('imports notes from a file on the phone, and asks before importing the same file again', async () => {
  let imports: unknown[] = []
  const imp = (status: string, over: Record<string, unknown> = {}) => ({ __typename: 'NoteImport', id: 'i1', fileName: 'vault.zip', status, progress: 100, created: 2, notes: [{ __typename: 'Note', id: 'n1', title: 'Graphs' }], skipped: [], error: null, createdAt: new Date().toISOString(), finishedAt: null, ...over })
  jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///vault.zip', name: 'vault.zip', size: 4096, mimeType: 'application/zip' }] } as never)
  const api = mockApi({
    NoteImports: () => ({ data: { noteImports: imports } }),
    CreateNoteUpload: () => ({ data: { createUploadIntent: { __typename: 'UploadIntentPayload', intent: { __typename: 'UploadIntent', fileId: 'f1', uploadUrl: 'https://storage.test/put', uploadHeaders: [] }, userErrors: [] } } }),
    CompleteNoteUpload: () => ok('completeUpload'),
    ImportNotes: () => ((imports = [imp('NEEDS_CONFIRMATION')]), { data: { importNotes: { __typename: 'NoteImportPayload', noteImport: imports[0], userErrors: [] } } }),
    ConfirmNoteImport: () => ((imports = [imp('DONE')]), { data: { confirmNoteImport: { __typename: 'NoteImportPayload', noteImport: imports[0], userErrors: [] } } }),
  })
  const graphql = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.startsWith('file://')) return { blob: async () => fileBlob(4096) } as unknown as Response
    if (url === 'https://storage.test/put') return { ok: true } as Response
    return graphql(input, init)
  }) as typeof fetch
  await inApollo(<ImportCard />)
  await fireEvent.press(await screen.findByRole('button', { name: 'Choose a file to import' }))
  expect(await screen.findByText('You imported vault.zip before. Import it again?')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'CreateNoteUpload')?.variables).toEqual({ input: { fileName: 'vault.zip', mimeType: 'application/zip', sizeBytes: 4096, purpose: 'IMPORT' } })
  expect(api.calls.find((c) => c.op === 'ImportNotes')?.variables).toEqual({ fileId: 'f1' })
  await fireEvent.press(screen.getByRole('button', { name: 'Import again' }))
  expect(await screen.findByText('2 notes imported from vault.zip.')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('link', { name: 'Graphs' }))
  expect(router.push).toHaveBeenCalledWith('/notes/n1')
})

it('refuses a file the importer cannot read', async () => {
  jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///photo.jpg', name: 'photo.jpg', size: 10, mimeType: 'image/jpeg' }] } as never)
  const api = mockApi({ NoteImports: () => ({ data: { noteImports: [] } }) })
  await inApollo(<ImportCard />)
  await fireEvent.press(await screen.findByRole('button', { name: 'Choose a file to import' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Choose a .zip, .md or .txt file.')
  expect(api.ops()).not.toContain('CreateNoteUpload')
})
