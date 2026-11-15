import { UploadLimits } from '@/lib/contracts/domain/enums'
import { externalUrl } from '@/lib/safe-url'

/** How many files one share keeps. Anything past this is listed and explained, not uploaded. */
export const SHARE_MAX_FILES = 10

/** Shown when the server (or this phone) will not take the type yet. */
export const TYPE_NOT_READY = "This file type isn't supported yet"

const IMAGES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const HEIC = new Set(['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'])
const FILES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
])

const BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  heic: 'image/heic', heif: 'image/heif',
  pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain', text: 'text/plain',
}

export type ShareFileKind = 'image' | 'heic' | 'file' | 'unsupported'

export type ClassifiedFile = {
  name: string
  mimeType: string
  size: number | null
  kind: ShareFileKind
  message: string | null
}

/** The type to trust: a known type from the sender, otherwise the file name. */
export function shareMime(name: string, given: string | null | undefined): string {
  const declared = (given ?? '').split(';')[0]?.trim().toLowerCase() ?? ''
  const fromName = BY_EXTENSION[name.split('.').pop()?.toLowerCase() ?? ''] ?? ''
  if (declared && declared !== 'application/octet-stream' && declared !== '*/*') {
    if (IMAGES.has(declared) || HEIC.has(declared) || FILES.has(declared)) return declared
    if (fromName) return fromName
    return declared
  }
  return fromName || declared || 'application/octet-stream'
}

function limitFor(mime: string): number | null {
  if (IMAGES.has(mime) || HEIC.has(mime)) return UploadLimits.image
  if (FILES.has(mime)) return UploadLimits.document
  return null
}

function sizeLabel(bytes: number): string {
  return bytes < 1024 ** 2 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

/** One shared file: an image (HEIC is converted later), a document, or a reason it cannot be saved. */
export function classifyFile(input: { name: string; mimeType: string | null | undefined; size: number | null }): ClassifiedFile {
  const name = input.name.trim() || 'file'
  const mimeType = shareMime(name, input.mimeType)
  const limit = limitFor(mimeType)
  if (limit == null) return { name, mimeType, size: input.size, kind: 'unsupported', message: TYPE_NOT_READY }
  if (input.size != null && input.size > limit) {
    return { name, mimeType, size: input.size, kind: 'unsupported', message: `${name} is ${sizeLabel(input.size)}. Files like this can be at most ${Math.round(limit / 1024 ** 2)} MB.` }
  }
  const kind: ShareFileKind = HEIC.has(mimeType) ? 'heic' : IMAGES.has(mimeType) ? 'image' : 'file'
  return { name, mimeType, size: input.size, kind, message: null }
}

export type IncomingShare = {
  text?: string | null
  webUrl?: string | null
  files?: { fileName?: string | null; mimeType?: string | null; size?: number | null; path?: string | null }[] | null
}

export type PreparedShare = {
  text: string | null
  files: (ClassifiedFile & { path: string })[]
}

/** Plain text and links become the note body. Files past the first ten are kept in the list with an explanation. */
export function prepareShare(intent: IncomingShare): PreparedShare {
  const files = (intent.files ?? []).map((file, index) => {
    const classified = classifyFile({ name: file.fileName?.trim() || `file-${index + 1}`, mimeType: file.mimeType, size: file.size ?? null })
    return { ...classified, path: file.path ?? '' }
  })
  files.forEach((file, index) => {
    if (index >= SHARE_MAX_FILES && !file.message) {
      file.kind = 'unsupported'
      file.message = `Only ${SHARE_MAX_FILES} files can be saved from one share.`
    }
  })
  return { text: shareBody(intent.text, intent.webUrl), files }
}

/** Shared words, plus a link when it is not already in those words. */
export function shareBody(text: string | null | undefined, webUrl: string | null | undefined): string | null {
  const body = text?.replace(/\u0000/g, '').trim() ?? ''
  const url = webUrl?.trim() ?? ''
  if (!body && !url) return null
  if (!body) return url
  if (!url || body.includes(url)) return body
  return `${body}\n${url}`
}

/** A note title from the first file name, or the first line of shared text. */
export function noteTitleForShare(fileName: string | null, text: string | null): string {
  const fromFile = fileName?.replace(/\.[a-z0-9]{1,8}$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200) ?? ''
  if (fromFile) return fromFile
  const line = text?.split('\n').map((part) => part.trim()).find(Boolean)?.slice(0, 200)
  return line || 'Shared note'
}

/** The server refused the declared type. Other failures keep the server's own words. */
export function uploadFailureMessage(message: string): string {
  if (/not accepted here/i.test(message)) return TYPE_NOT_READY
  return message || 'The file could not be uploaded. Try again.'
}

/**
 * Upload is not in the default unverified-action list. If that list later names an upload action, saving waits
 * and the verify prompt stays up. Images and documents are not the under-13 capture gate.
 */
export const UPLOAD_GATE_IDS = ['file.upload', 'note.upload', 'upload'] as const

export function verificationBlocksUpload(actions: readonly string[]): boolean {
  return actions.some((action) => (UPLOAD_GATE_IDS as readonly string[]).includes(action))
}

const URL_IN_TEXT = /https?:\/\/[^\s<>]+/gi

/** Drop the sentence punctuation a share often glues to the end of a link. */
function cleanUrl(raw: string): string {
  return raw.replace(/[),.;:!?]+$/g, '')
}

type Inline = { type: 'text'; text: string; marks?: { type: 'link'; attrs: { href: string } }[] }

/** One line of shared text, with http(s) links marked when they are safe. */
export function inlineFromLine(line: string): Inline[] {
  const out: Inline[] = []
  let cursor = 0
  for (const match of line.matchAll(URL_IN_TEXT)) {
    const start = match.index ?? 0
    const raw = match[0]
    const href = cleanUrl(raw)
    const safe = externalUrl(href)
    if (start > cursor) out.push({ type: 'text', text: line.slice(cursor, start) })
    if (safe && href.length > 0) out.push({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href: safe } }] })
    else out.push({ type: 'text', text: raw })
    cursor = start + raw.length
  }
  if (cursor < line.length) out.push({ type: 'text', text: line.slice(cursor) })
  return out.filter((node) => node.text.length > 0).map((node) => ({ ...node, text: node.text.slice(0, 10_000) }))
}

type Paragraph = { type: 'paragraph'; content?: Inline[] }
type Doc = { type: 'doc'; content: Paragraph[] }

/** Paragraphs to add under a note's text. Blank lines are skipped; the card stays inside the text limits. */
export function paragraphsFromShareText(text: string): Paragraph[] {
  return text
    .replace(/\u0000/g, '')
    .slice(0, 100_000)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 500)
    .map((line) => ({ type: 'paragraph' as const, content: inlineFromLine(line) }))
    .filter((paragraph) => (paragraph.content?.length ?? 0) > 0)
}

function isEmptyDoc(content: readonly { type: string; content?: unknown[] }[]): boolean {
  return content.length === 0 || (content.length === 1 && content[0]?.type === 'paragraph' && !(content[0].content?.length))
}

/** The note's document with the shared words added. An empty first paragraph is replaced. */
export function appendShareToDoc(doc: unknown, text: string): Doc {
  const current = (doc as { type?: string; content?: Paragraph[] } | null)?.type === 'doc' ? ((doc as { content?: Paragraph[] }).content ?? []) : []
  const extra = paragraphsFromShareText(text)
  return { type: 'doc', content: isEmptyDoc(current) ? extra : [...current, ...extra] }
}
