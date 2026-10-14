import type { ApolloClient } from '@apollo/client'
import { uploadFile } from '@/features/notes/media/NoteMedia'

/**
 * The size signed into an upload URL is the bytes sent (storage refuses any other): a picker's reported size is not
 * trusted, since a camera photo is compressed after the picker measures it (found on a Samsung phone).
 */
it('declares the size of the bytes it sends, not the size the picker reported', async () => {
  const body = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' })
  const put = jest.fn(async () => ({ ok: true }))
  globalThis.fetch = jest.fn(async (url: string) => (url === 'file:///photo.jpg' ? { blob: async () => body } : put())) as unknown as typeof fetch
  const mutate = jest
    .fn()
    .mockResolvedValueOnce({ data: { createUploadIntent: { intent: { fileId: 'f1', uploadUrl: 'http://storage/put', uploadHeaders: [{ name: 'Content-Type', value: 'image/jpeg' }, { name: 'Content-Length', value: '3' }] }, userErrors: [] } } })
    .mockResolvedValueOnce({ data: { completeUpload: { userErrors: [] } } })
  const id = await uploadFile({ mutate } as unknown as ApolloClient, { uri: 'file:///photo.jpg', name: 'photo.jpg', mimeType: 'image/jpeg', size: 4_096_000 }, { purpose: 'ATTACHMENT', parentId: 'n1' })
  expect(id).toBe('f1')
  expect(mutate.mock.calls[0]![0].variables.input.sizeBytes).toBe(3)
  expect(put).toHaveBeenCalled()
})
