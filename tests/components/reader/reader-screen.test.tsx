import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import { PdfReaderScreen } from '@/features/reader/PdfReaderScreen'
import type { DomMark, DomSelection } from '@/features/reader/PdfDom'
import * as actions from '@/features/notes/store/actions'
import { createApolloClient } from '@/lib/apollo'
import { mockApi } from '../../support/api'
import { renderInApp } from '../../support/render'

/**
 * The PDF reader screen on the phone (lvn-backend ADR-0040). The PDF itself (a DOM component running pdf.js) is a
 * stand-in here that reports what a reader would do with it; the screen's own part is what is tested.
 */

const mockNoteId = '01920000-0000-7000-8000-00000000a001'
const NOTE = mockNoteId
const mockFileId = '01920000-0000-7000-8000-00000000f0a1'
const FILE = mockFileId
const mockPassage: DomSelection = { page: 1, rects: [[0.1, 0.1, 0.5, 0.12]], quote: 'Cells divide' }

let mockAccess: 'OWNER' | 'READER' = 'OWNER'
const mockQuoteCard = { id: '01920000-0000-7000-8000-00000000c0a2', noteId: mockNoteId, type: 'quote', position: 'a1', revision: 1, content: { doc: { type: 'doc', content: [] }, anchor: { fileId: mockFileId, page: 2, rects: [[0.1, 0.2, 0.4, 0.22]] } }, dirty: false, deleted: false }

jest.mock('@/features/reader/PdfDom', () => {
  const { Pressable, Text, View } = require('react-native')
  return {
    __esModule: true,
    default: (props: { marks: DomMark[]; command: unknown; onReady: (n: number) => Promise<void>; onSelection: (s: DomSelection | null) => Promise<void> }) => (
      <View>
        <Text>{`marks: ${props.marks.map((m) => m.kind).join(',')}`}</Text>
        <Text>{`command: ${JSON.stringify(props.command)}`}</Text>
        <Pressable onPress={() => void props.onReady(3)}>
          <Text>pdf loaded</Text>
        </Pressable>
        <Pressable onPress={() => void props.onSelection(mockPassage)}>
          <Text>select words</Text>
        </Pressable>
      </View>
    ),
  }
})
jest.mock('@/features/notes/store/db', () => ({
  getNote: jest.fn(async () => ({ id: mockNoteId, title: 'Biology', ownerId: 'u', ownerName: 'Ravi', access: mockAccess, visibility: 'PRIVATE', publishedAt: null, deletedAt: null, updatedAt: '', localOnly: false, titleDirty: false, pendingTrash: null })),
  getCards: jest.fn(async () => [mockQuoteCard]),
  subscribe: () => () => {},
  getValue: jest.fn(async () => null),
  setValue: jest.fn(async () => {}),
}))
jest.mock('@/features/notes/store/actions', () => ({ appendCard: jest.fn(async () => ({ id: 'new-card' })) }))
jest.mock('@/features/notes/sync/engine', () => ({ syncSoon: jest.fn(), syncNow: jest.fn(async () => {}), getSyncStatus: () => ({ state: 'idle' }), subscribeSyncStatus: () => () => {} }))
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true } }))

const file = { __typename: 'MediaFile', id: FILE, url: 'http://storage.test/b.pdf', expiresAt: '2026-10-09T12:00:00.000Z', mimeType: 'application/pdf', fileName: 'Biology.pdf', sizeBytes: 1000 }
const highlight = { __typename: 'PdfHighlight', id: '01920000-0000-7000-8000-0000000e0001', fileId: FILE, page: 1, kind: 'TEXT', color: 'YELLOW', rects: [[0.1, 0.3, 0.5, 0.32]], quote: 'Light', comment: null, cardId: null }

const show = () =>
  renderInApp(
    <ApolloProvider client={createApolloClient()}>
      <PdfReaderScreen noteId={NOTE} fileId={FILE} />
    </ApolloProvider>,
  )

beforeEach(() => jest.clearAllMocks())

it('owners highlight selected words and add them to the note with their page', async () => {
  mockAccess = 'OWNER'
  const api = mockApi({
    PhoneNoteFile: () => ({ data: { noteFile: file } }),
    PhoneNoteHighlights: () => ({ data: { note: { __typename: 'Note', id: NOTE, highlights: [highlight] } } }),
    PhoneAddHighlight: (v) => ({ data: { addPdfHighlight: { __typename: 'PdfHighlightPayload', highlight: { ...highlight, id: '01920000-0000-7000-8000-0000000e0002', ...(v.input as object) }, userErrors: [] } } }),
  })
  await show()
  // The highlight and the card made from page 2 are drawn on the PDF.
  expect(await screen.findByText('marks: highlight,anchor')).toBeTruthy()
  fireEvent.press(screen.getByText('pdf loaded'))
  expect(await screen.findByText('Page 1 of 3')).toBeTruthy()

  fireEvent.press(screen.getByText('select words'))
  fireEvent.press(await screen.findByRole('button', { name: 'Highlight in green' }))
  await waitFor(() => expect(api.ops()).toContain('PhoneAddHighlight'))
  expect(api.calls.find((c) => c.op === 'PhoneAddHighlight')!.variables).toEqual({ input: { noteId: NOTE, fileId: FILE, page: 1, kind: 'TEXT', rects: mockPassage.rects, quote: 'Cells divide', color: 'GREEN' } })
  expect(await screen.findByText('marks: highlight,highlight,anchor')).toBeTruthy()

  fireEvent.press(screen.getByText('select words'))
  fireEvent.press(await screen.findByText('Add to notes'))
  await waitFor(() =>
    expect(actions.appendCard).toHaveBeenCalledWith(NOTE, 'quote', {
      doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cells divide' }] }] },
      anchor: { fileId: FILE, page: 1, rects: mockPassage.rects, quote: 'Cells divide' },
    }),
  )
  expect(await screen.findByText('Added to your notes')).toBeTruthy()

  // The card's chip in the notes sheet brings the PDF to its passage.
  fireEvent.press(screen.getByRole('button', { name: 'Show notes' }))
  fireEvent.press(await screen.findByRole('button', { name: 'Open the PDF at page 2' }))
  expect(await screen.findByText(/command: \{"kind":"goTo","page":2,"rects":\[\[0\.1,0\.2,0\.4,0\.22\]\]/)).toBeTruthy()
})

it('readers cannot highlight but can start notes of their own on the PDF', async () => {
  mockAccess = 'READER'
  const api = mockApi({
    PhoneNoteFile: () => ({ data: { noteFile: file } }),
    PhoneStudyPdf: () => ({ data: { studyPdf: { __typename: 'NotePayload', note: { __typename: 'Note', id: '01920000-0000-7000-8000-00000000a0ff' }, userErrors: [] } } }),
  })
  await show()
  fireEvent.press(await screen.findByText('select words'))
  expect(await screen.findByLabelText('Selected words')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Highlight in yellow' })).toBeNull()
  expect(screen.queryByText('Add to notes')).toBeNull()
  expect(api.ops()).not.toContain('PhoneNoteHighlights')

  fireEvent.press(screen.getByRole('button', { name: 'Show notes' }))
  fireEvent.press(await screen.findByText('Start my notes on this PDF'))
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith(`/notes/read/01920000-0000-7000-8000-00000000a0ff/${FILE}`))
})

it('converts the PDF into cards: the new note opens, follows the engine and syncs the cards when done', async () => {
  mockAccess = 'OWNER'
  const { syncNow } = jest.requireMock('@/features/notes/sync/engine') as { syncNow: jest.Mock }
  const NEW = '01920000-0000-7000-8000-00000000a0cc'
  const conversion = (status: string, extra: object = {}) => ({ __typename: 'PdfConversion', id: 'c1', status, progress: status === 'DONE' ? 100 : 15, pages: 2, scannedPages: 0, cards: null, aiPages: null, aiRejected: null, error: null, ...extra })
  let checks = 0
  const api = mockApi({
    PhoneNoteFile: () => ({ data: { noteFile: file } }),
    PhoneNoteHighlights: () => ({ data: { note: { __typename: 'Note', id: NOTE, highlights: [] } } }),
    PhonePdfConversion: () => {
      checks++
      return { data: { note: { __typename: 'Note', id: NOTE, pdfConversion: checks === 1 ? null : checks < 3 ? conversion('PARSING') : conversion('DONE', { cards: 7 }) } } }
    },
    PhoneConvertPdf: () => ({ data: { convertPdfToNote: { __typename: 'PdfConversionPayload', conversion: { ...conversion('TRIAGE'), note: { __typename: 'Note', id: NEW } }, userErrors: [] } } }),
  })
  await show()
  fireEvent.press(await screen.findByRole('button', { name: 'Show notes' }))
  fireEvent.press(await screen.findByText('Convert this PDF into cards'))
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith(`/notes/read/${NEW}/${FILE}`))
  expect(api.calls.find((c) => c.op === 'PhoneConvertPdf')!.variables).toEqual({ noteId: NOTE, fileId: FILE })
  expect(syncNow).toHaveBeenCalled()
})

it('follows a conversion in progress and pulls its cards when it is done', async () => {
  mockAccess = 'OWNER'
  const { syncNow } = jest.requireMock('@/features/notes/sync/engine') as { syncNow: jest.Mock }
  let checks = 0
  mockApi({
    PhoneNoteFile: () => ({ data: { noteFile: file } }),
    PhoneNoteHighlights: () => ({ data: { note: { __typename: 'Note', id: NOTE, highlights: [] } } }),
    PhonePdfConversion: () => {
      checks++
      const status = checks < 2 ? 'PARSING' : 'DONE'
      return { data: { note: { __typename: 'Note', id: NOTE, pdfConversion: { __typename: 'PdfConversion', id: 'c1', status, progress: status === 'DONE' ? 100 : 15, pages: 2, scannedPages: 1, cards: status === 'DONE' ? 7 : null, aiPages: status === 'DONE' ? 1 : null, aiRejected: status === 'DONE' ? 0 : null, error: null } } } }
    },
  })
  await show()
  expect(await screen.findByText('Reading the PDF… 15%')).toBeTruthy()
  // The scanned page the OCR was unsure of was read again by AI (lvn-backend ADR-0063).
  expect(await screen.findByText('Made 7 cards from 2 pages. Check them beside the PDF. AI read 1 unclear page again. To mend words the conversion broke, use Clean up the text in AI tasks.', {}, { timeout: 8000 })).toBeTruthy()
  await waitFor(() => expect(syncNow).toHaveBeenCalled())
}, 15000)
