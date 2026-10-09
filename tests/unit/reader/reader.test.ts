import { areaRect, quoteOf, selectionRects } from '@/features/reader/geometry'
import { PDFJS_VERSION, readerPath } from '@/features/reader/paths'
import { keepAnchor } from '@/features/notes/store/actions'

jest.mock('@/features/notes/store/db', () => ({}))

/** lvn-backend ADR-0040 on the phone: places on a page, the reader's links and cards keeping their page. */
describe('the PDF reader on the phone', () => {
  it('uses the pdf.js the app is built with, whose files the web serves', () => {
    expect(PDFJS_VERSION).toBe(jest.requireActual<{ version: string }>('pdfjs-dist/package.json').version)
  })

  it('links to a PDF of a note, at a page and a card', () => {
    expect(readerPath('n', 'f')).toBe('/notes/read/n/f')
    expect(readerPath('n', 'f', { page: 4, card: 'c' })).toBe('/notes/read/n/f?page=4&card=c')
  })

  it('turns a selection into one rectangle per line, as fractions of the page', () => {
    const page = { left: 0, top: 0, width: 400, height: 800 }
    expect(selectionRects([{ left: 40, top: 80, right: 200, bottom: 96 }, { left: 198, top: 81, right: 360, bottom: 95 }], page)).toEqual([[0.1, 0.1, 0.9, 0.12]])
    expect(areaRect({ x: 0.5, y: 0.5 }, { x: 0.1, y: 0.2 })).toEqual([0.1, 0.2, 0.5, 0.5])
    expect(quoteOf('Mito-\nchondria  make ATP')).toBe('Mitochondria make ATP')
  })

  it('keeps a card’s page through an edit that does not mention it', () => {
    const anchor = { fileId: 'f', page: 2 }
    expect(keepAnchor({ doc: 1, anchor }, { doc: 2 })).toEqual({ doc: 2, anchor })
    expect(keepAnchor({ doc: 1 }, { doc: 2 })).toEqual({ doc: 2 })
    expect(keepAnchor({ doc: 1, anchor }, { doc: 2, anchor: { fileId: 'f', page: 3 } })).toEqual({ doc: 2, anchor: { fileId: 'f', page: 3 } })
  })
})
