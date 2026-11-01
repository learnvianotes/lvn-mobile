import type { ApolloClient } from '@apollo/client'
import { useApolloClient, useQuery } from '@apollo/client/react'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { CompleteNoteUploadDocument, CreateNoteUploadDocument, PhoneNoteMediaDocument, type PhoneMediaFieldsFragment, type PhoneNoteMediaQuery } from '@/graphql/generated/graphql'
import { reportClientError } from '@/lib/client-errors'

/**
 * A note's pictures, video, audio and files on the phone (lvn-backend §8.1, ADR-0041). Media cards hold only a file id;
 * the read URLs are short-lived, so they are asked for online when the note opens and kept for the screen. A file
 * uploaded here is shown from the phone until the server's copy is there.
 */

export type MediaFile = PhoneMediaFieldsFragment
type Media = { byFile: Map<string, MediaFile>; local: Map<string, string>; online: boolean }

const MediaContext = createContext<Media>({ byFile: new Map(), local: new Map(), online: false })

/** Files uploaded from this phone in this session: their own address on the phone, until the server's URL arrives. */
const uploadedHere = new Map<string, string>()
const listeners = new Set<() => void>()

type MediaEdges = NonNullable<PhoneNoteMediaQuery['note']>['cards']['edges']

export function MediaProvider({ noteId, cardIds, children }: { noteId: string; cardIds: string; children: ReactNode }) {
  const client = useApolloClient()
  // Errors are not cached: a failed answer would otherwise put `note: null` where every screen of this note reads it.
  const { data, error, refetch } = useQuery(PhoneNoteMediaDocument, { variables: { id: noteId }, fetchPolicy: 'cache-and-network' })
  const [, bump] = useState(0)
  // The pages after the first, for a note of more than 100 cards; asked for again whenever the first page is.
  const first = data?.note?.cards
  const [rest, setRest] = useState<MediaEdges>([])
  useEffect(() => {
    let stopped = false
    let after = first?.pageInfo.hasNextPage ? first.pageInfo.endCursor : null
    void (async () => {
      const edges: MediaEdges = []
      while (after && !stopped) {
        const res = await client.query({ query: PhoneNoteMediaDocument, variables: { id: noteId, after }, fetchPolicy: 'network-only' }).catch(() => null)
        const page = res?.data?.note?.cards
        if (!page) break
        edges.push(...page.edges)
        after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null
      }
      if (!stopped) setRest(edges)
    })()
    return () => {
      stopped = true
    }
  }, [client, noteId, first])
  // A card added or sent since: ask again (its media URL is new).
  useEffect(() => {
    void refetch().catch(() => undefined)
  }, [cardIds, refetch])
  useEffect(() => {
    const l = () => bump((n) => n + 1)
    listeners.add(l)
    return () => void listeners.delete(l)
  }, [])
  const value = useMemo<Media>(() => {
    const byFile = new Map<string, MediaFile>()
    for (const { node } of [...(first?.edges ?? []), ...rest]) {
      const fileId = (node.content as { fileId?: string } | null)?.fileId
      if (fileId && node.media) byFile.set(fileId, node.media)
    }
    return { byFile, local: uploadedHere, online: !error }
  }, [first, rest, error])
  return <MediaContext.Provider value={value}>{children}</MediaContext.Provider>
}

/** The server's file for a media card, or the phone's own copy of one uploaded here. */
export function useMediaFile(fileId: string | undefined): { file: MediaFile | null; localUri: string | null } {
  const m = useContext(MediaContext)
  if (!fileId) return { file: null, localUri: null }
  return { file: m.byFile.get(fileId) ?? null, localUri: m.local.get(fileId) ?? null }
}

/** What notes take, by card type (as lvn-web's media.tsx); a file card takes PDFs. */
export const ACCEPT = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
  audio: ['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/webm'],
  file: ['application/pdf'],
} as const

const BY_EXTENSION: Record<string, string> = { mov: 'video/quicktime', m4a: 'audio/mp4', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', mp4: 'video/mp4', webm: 'video/webm' }

/** The type the API wants for a picked file: what the picker said, or its extension. */
export function mimeOf(name: string, given: string | null | undefined): string {
  const all: readonly string[] = [...ACCEPT.image, ...ACCEPT.video, ...ACCEPT.audio, ...ACCEPT.file]
  if (given && all.includes(given)) return given
  if (given === 'audio/x-m4a') return 'audio/mp4'
  return BY_EXTENSION[name.split('.').pop()?.toLowerCase() ?? ''] ?? given ?? 'application/octet-stream'
}

/** The card a picked file becomes, or null when notes do not take it. */
export function cardTypeFor(mime: string): 'image' | 'video' | 'audio' | 'file' | null {
  for (const type of ['image', 'video', 'audio', 'file'] as const) if ((ACCEPT[type] as readonly string[]).includes(mime)) return type
  return null
}

export class UploadError extends Error {}

const UPLOAD_FAILED = 'The file could not be uploaded. Try again.'

/** PUT bytes to a signed upload URL. A failure is reported with no file name, address or email. */
export async function putStoredFile(client: ApolloClient, upload: { uploadUrl: string; uploadHeaders: { name: string; value: string }[] }, body: Blob, mimeType: string): Promise<void> {
  const headers: Record<string, string> = {}
  for (const h of upload.uploadHeaders) if (h.name.toLowerCase() !== 'content-length') headers[h.name] = h.value
  // Android sends a blob with the blob's own type (guessed from the file's extension) whatever Content-Type is given,
  // and storage checks the type signed into the URL: the body takes the type the upload was asked for.
  const typed = body.type === mimeType ? body : body.slice(0, body.size, mimeType)
  let put: Response
  try {
    put = await fetch(upload.uploadUrl, { method: 'PUT', headers, body: typed })
  } catch {
    reportClientError(client, { code: 'upload', message: UPLOAD_FAILED })
    throw new UploadError(UPLOAD_FAILED)
  }
  if (!put.ok) {
    reportClientError(client, { code: 'upload', message: UPLOAD_FAILED })
    throw new UploadError(UPLOAD_FAILED)
  }
}

/**
 * Uploads a file picked on the phone (§8.1): an intent from the API, a PUT straight to storage with exactly the headers
 * it asked for, then the API checks the file. Returns the file id.
 */
export async function uploadFile(client: ApolloClient, picked: { uri: string; name: string; mimeType: string; size?: number | null }, purpose: { purpose: 'ATTACHMENT' | 'IMPORT' | 'VERIFICATION_DOCUMENT' | 'COVER' | 'GROUP_PICTURE'; parentId?: string }): Promise<string> {
  const body = await (await fetch(picked.uri)).blob()
  // The size signed into the upload URL must be the bytes sent: a picker's reported size can differ (a camera photo is
  // compressed after the picker measures it), and storage then refuses the upload.
  const res = await client.mutate({ mutation: CreateNoteUploadDocument, variables: { input: { fileName: picked.name || 'file', mimeType: picked.mimeType, sizeBytes: body.size, purpose: purpose.purpose, ...(purpose.parentId ? { parentId: purpose.parentId } : {}) } } })
  const intent = res.data?.createUploadIntent.intent
  if (!intent) throw new UploadError(res.data?.createUploadIntent.userErrors[0]?.message ?? 'The file could not be uploaded.')
  await putStoredFile(client, intent, body, picked.mimeType)
  const done = await client.mutate({ mutation: CompleteNoteUploadDocument, variables: { fileId: intent.fileId } })
  const problem = done.data?.completeUpload.userErrors[0]?.message
  if (problem) throw new UploadError(problem)
  return intent.fileId
}

/** A picture, video, recording or PDF for a note's card; shown from the phone until the server's copy is there. */
export async function uploadToNote(client: ApolloClient, noteId: string, picked: { uri: string; name: string; mimeType: string; size?: number | null }): Promise<string> {
  const fileId = await uploadFile(client, picked, { purpose: 'ATTACHMENT', parentId: noteId })
  uploadedHere.set(fileId, picked.uri)
  listeners.forEach((l) => l())
  return fileId
}
