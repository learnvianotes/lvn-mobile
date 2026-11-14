import { cardTypeFor } from '@/features/notes/media/NoteMedia'
import { docSchema } from '@/lib/contracts/validation/rich-text'
import { UploadLimits } from '@/lib/contracts/domain/enums'
import {
  SHARE_MAX_FILES,
  TYPE_NOT_READY,
  appendShareToDoc,
  classifyFile,
  noteTitleForShare,
  paragraphsFromShareText,
  prepareShare,
  shareBody,
  shareMime,
  uploadFailureMessage,
  verificationBlocksUpload,
} from '@/features/share/classify'

const MB = 1024 ** 2

describe('share types', () => {
  it('keeps photos, HEIC, PDF, Office and plain text, and refuses the rest', () => {
    expect(classifyFile({ name: 'a.jpg', mimeType: 'image/jpeg', size: 10 }).kind).toBe('image')
    expect(classifyFile({ name: 'a.png', mimeType: 'image/png', size: 10 }).kind).toBe('image')
    expect(classifyFile({ name: 'a.webp', mimeType: 'image/webp', size: 10 }).kind).toBe('image')
    expect(classifyFile({ name: 'a.gif', mimeType: 'image/gif', size: 10 }).kind).toBe('image')
    expect(classifyFile({ name: 'a.HEIC', mimeType: 'application/octet-stream', size: 10 })).toMatchObject({ kind: 'heic', mimeType: 'image/heic' })
    expect(classifyFile({ name: 'a.heif', mimeType: 'image/heif', size: 10 }).kind).toBe('heic')
    expect(classifyFile({ name: 'a.pdf', mimeType: 'application/pdf', size: 10 }).kind).toBe('file')
    expect(classifyFile({ name: 'a.doc', mimeType: 'application/msword', size: 10 }).kind).toBe('file')
    expect(classifyFile({ name: 'a.docx', mimeType: '*/*', size: 10 }).mimeType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    expect(classifyFile({ name: 'a.ppt', mimeType: 'application/vnd.ms-powerpoint', size: 10 }).kind).toBe('file')
    expect(classifyFile({ name: 'a.pptx', mimeType: null, size: 10 }).kind).toBe('file')
    expect(classifyFile({ name: 'a.txt', mimeType: 'text/plain', size: 10 }).kind).toBe('file')
    expect(classifyFile({ name: 'a.zip', mimeType: 'application/zip', size: 10 })).toMatchObject({ kind: 'unsupported', message: TYPE_NOT_READY })
    expect(classifyFile({ name: 'a.mp3', mimeType: 'audio/mpeg', size: 10 }).kind).toBe('unsupported')
    expect(classifyFile({ name: 'a.mp4', mimeType: 'video/mp4', size: 10 }).kind).toBe('unsupported')
  })

  it('uses the file name when the sender does not name a known type', () => {
    expect(shareMime('notes.TXT', 'application/octet-stream')).toBe('text/plain')
    expect(shareMime('photo.jpg', 'image/jpg')).toBe('image/jpeg')
    expect(shareMime('mystery', '')).toBe('application/octet-stream')
  })

  it('explains a file that is too large, and stops after ten files', () => {
    const image = classifyFile({ name: 'big.jpg', mimeType: 'image/jpeg', size: UploadLimits.image + 1 })
    expect(image.kind).toBe('unsupported')
    expect(image.message).toContain('20 MB')
    const pdf = classifyFile({ name: 'big.pdf', mimeType: 'application/pdf', size: UploadLimits.document + MB })
    expect(pdf.message).toContain('50 MB')
    expect(classifyFile({ name: 'ok.jpg', mimeType: 'image/jpeg', size: UploadLimits.image }).kind).toBe('image')

    const files = Array.from({ length: SHARE_MAX_FILES + 1 }, (_, index) => ({ fileName: `${index}.png`, mimeType: 'image/png', size: 1, path: `file:///${index}.png` }))
    const prepared = prepareShare({ files })
    expect(prepared.files[SHARE_MAX_FILES - 1]?.kind).toBe('image')
    expect(prepared.files[SHARE_MAX_FILES]).toMatchObject({ kind: 'unsupported', message: 'Only 10 files can be saved from one share.' })
  })

  it('puts shared words and a link in the note body', () => {
    expect(shareBody('See this', 'https://learnvianotes.in/notes')).toBe('See this\nhttps://learnvianotes.in/notes')
    expect(shareBody('Already https://learnvianotes.in/notes', 'https://learnvianotes.in/notes')).toBe('Already https://learnvianotes.in/notes')
    expect(shareBody(null, 'https://example.com')).toBe('https://example.com')
    expect(shareBody('  ', null)).toBeNull()
    expect(noteTitleForShare('Chapter_3.pdf', 'ignored')).toBe('Chapter 3')
    expect(noteTitleForShare(null, 'First line\nsecond')).toBe('First line')
    expect(noteTitleForShare(null, null)).toBe('Shared note')
  })

  it('names a type the server has not accepted yet, and leaves other failures alone', () => {
    expect(uploadFailureMessage('This kind of file is not accepted here (text/plain)')).toBe(TYPE_NOT_READY)
    expect(uploadFailureMessage('Connect to the internet to save this share into a note.')).toBe('Connect to the internet to save this share into a note.')
    expect(verificationBlocksUpload([])).toBe(false)
    expect(verificationBlocksUpload(['note.publish'])).toBe(false)
    expect(verificationBlocksUpload(['file.upload'])).toBe(true)
  })

  it('turns shared text into a document the note can store, with safe links', () => {
    const paragraphs = paragraphsFromShareText('Hello\n\nSee https://example.com/a).')
    expect(paragraphs).toHaveLength(2)
    expect(paragraphs[1]?.content?.[1]).toMatchObject({ text: 'https://example.com/a', marks: [{ type: 'link', attrs: { href: 'https://example.com/a' } }] })
    const doc = appendShareToDoc({ type: 'doc', content: [{ type: 'paragraph' }] }, 'Added line')
    expect(docSchema.parse(doc).content).toEqual([{ type: 'paragraph', content: [{ type: 'text', text: 'Added line' }] }])
    const kept = appendShareToDoc({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Already' }] }] }, 'More')
    expect(kept.content).toHaveLength(2)
  })

  it('offers Office and text files as file cards, and leaves HEIC to be converted first', () => {
    expect(cardTypeFor('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('file')
    expect(cardTypeFor('application/vnd.openxmlformats-officedocument.presentationml.presentation')).toBe('file')
    expect(cardTypeFor('text/plain')).toBe('file')
    expect(cardTypeFor('application/pdf')).toBe('file')
    expect(cardTypeFor('image/jpeg')).toBe('image')
    expect(cardTypeFor('image/heic')).toBeNull()
    expect(cardTypeFor('application/zip')).toBeNull()
  })
})
