import { pdfSource } from '@/features/reader/ranges'

describe('pdfSource', () => {
  const original = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = original
  })

  it('does not fetch a PDF address that is not http(s)', async () => {
    const fetchMock = jest.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
    await expect(pdfSource({} as never, 'file:///data/secret.pdf', async () => null)).rejects.toThrow('the PDF could not be read')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not follow a refreshed address that is not http(s)', async () => {
    globalThis.fetch = jest.fn(async () => ({ ok: false, status: 403, headers: { get: () => null } })) as unknown as typeof fetch
    await expect(pdfSource({} as never, 'https://storage.test/a.pdf', async () => 'file:///etc/passwd')).rejects.toThrow('the PDF could not be read (403)')
  })
})
