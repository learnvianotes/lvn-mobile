import type { ApolloClient } from '@apollo/client'
import { UploadError, uploadFile, uploadFileName } from '@/features/notes/media/NoteMedia'

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

it('uses the file name, not a directory, and refuses an upload that is not http(s) or not a local file', async () => {
  expect(uploadFileName('../../notes/photo.jpg')).toBe('photo.jpg')
  expect(uploadFileName('')).toBe('file')
  const body = new Blob([new Uint8Array([1])], { type: 'image/jpeg' })
  globalThis.fetch = jest.fn(async () => ({ blob: async () => body, ok: true })) as unknown as typeof fetch
  const mutate = jest.fn(async () => ({ data: { createUploadIntent: { intent: { fileId: 'f1', uploadUrl: 'file:///data/data/com.learnvianotes/databases/lvn-notes.db', uploadHeaders: [] }, userErrors: [] } } }))
  await expect(uploadFile({ mutate } as unknown as ApolloClient, { uri: 'file:///photo.jpg', name: 'a/photo.jpg', mimeType: 'image/jpeg' }, { purpose: 'ATTACHMENT' })).rejects.toBeInstanceOf(UploadError)
  expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ variables: { input: expect.objectContaining({ fileName: 'photo.jpg' }) } }))
  await expect(uploadFile({ mutate: jest.fn() } as unknown as ApolloClient, { uri: 'https://evil.example/photo.jpg', name: 'photo.jpg', mimeType: 'image/jpeg' }, { purpose: 'ATTACHMENT' })).rejects.toBeInstanceOf(UploadError)
})
