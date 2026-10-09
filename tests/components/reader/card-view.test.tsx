import { fireEvent, screen } from '@testing-library/react-native'
import { CardView } from '@/features/notes/render/CardView'
import { renderInApp } from '../../support/render'

/** Cards and PDFs on the phone (lvn-backend ADR-0040). */
const anchor = { fileId: '01920000-0000-7000-8000-00000000f0a1', page: 12, rects: [[0.1, 0.1, 0.5, 0.12]] }
const quote = { doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cells divide' }] }] }, anchor }

it('a file card opens its PDF in the reader', async () => {
  const open = jest.fn()
  await renderInApp(<CardView type="file" content={{ fileId: anchor.fileId }} onOpenFile={open} />)
  fireEvent.press(screen.getByRole('button', { name: 'Read and make notes' }))
  expect(open).toHaveBeenCalledWith(anchor.fileId)
})

it('a card made from a PDF has a chip back to its page', async () => {
  const go = jest.fn()
  await renderInApp(<CardView type="quote" content={quote} onAnchor={go} />)
  expect(screen.getByText('Cells divide')).toBeTruthy()
  fireEvent.press(screen.getByRole('button', { name: 'Open the PDF at page 12' }))
  expect(go).toHaveBeenCalledWith(anchor)
})

it('without a way to open it, the card only says which page', async () => {
  await renderInApp(<CardView type="quote" content={quote} />)
  expect(screen.getByText('From page 12 of the PDF')).toBeTruthy()
  expect(screen.queryByRole('button')).toBeNull()
})
