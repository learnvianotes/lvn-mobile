import { pdfSource } from '@/features/reader/ranges'

/** The PDF is fetched only from an http(s) address. A file or intent URL is not sent to pdf.js. */
it('refuses a PDF address that is not http(s), including a refreshed one', async () => {
  const fetchMock = jest.fn()
  globalThis.fetch = fetchMock as unknown as typeof fetch
  await expect(pdfSource({} as never, 'file:///data/data/com.learnvianotes/databases/lvn-notes.db', async () => null)).rejects.toThrow(/could not be read/)
  await expect(pdfSource({} as never, 'intent://scan/#Intent;end', async () => 'https://storage.example/a.pdf')).rejects.toThrow(/could not be read/)
  expect(fetchMock).not.toHaveBeenCalled()
})
