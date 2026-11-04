import type { CardType } from '@/lib/contracts/domain/enums'

/**
 * Notes as the phone keeps them (lvn-backend §13.2): the server's last answer plus what was changed here and not yet
 * sent. `dirty` marks a change waiting for the next push; a frozen change lives in the outbox until answered.
 */
export type NoteAccess = 'OWNER' | 'EDITOR' | 'READER'
/** What a note is (lvn-backend ADR-0014): a note, a project, or a teacher's blog post or post. */
export type NoteKind = 'NOTE' | 'PROJECT' | 'BLOG' | 'POST'

export interface LocalNote {
  id: string
  title: string
  kind: NoteKind
  /** The folder and tags as the last pull brought them (ADR-0052); changed online, from the note's details */
  folderId: string | null
  folderName: string | null
  tags: string[]
  ownerId: string
  ownerName: string
  access: NoteAccess
  /** UNLISTED (anyone with the link, left out of lists and search) is set on the web; the phone shows it */
  visibility: 'PRIVATE' | 'SHARED' | 'UNLISTED' | 'PUBLIC'
  publishedAt: string | null
  deletedAt: string | null
  /** When the draft last changed, here or on the server (ISO) */
  updatedAt: string
  /** Written here and not yet created on the server */
  localOnly: boolean
  titleDirty: boolean
  /** Moved to the trash or restored here; the server does it on the next push */
  pendingTrash: 'TRASH' | 'RESTORE' | null
}

export interface LocalCard {
  id: string
  noteId: string
  type: CardType
  position: string
  /** The server's revision this card was last based on; null for a card made here */
  revision: number | null
  content: unknown
  dirty: boolean
  /** Deleted here; the server deletes it on the next push */
  deleted: boolean
}

export type SyncOpKind = 'CREATE_NOTE' | 'UPDATE_NOTE' | 'TRASH_NOTE' | 'RESTORE_NOTE'

/** The API's SyncOpInput */
export interface SyncOp {
  clientOpId: string
  kind: SyncOpKind
  noteId: string
  title?: string
  cards?: { id: string; type: CardType; position: string; content: unknown }[]
  ops?: { kind: 'UPSERT' | 'DELETE'; id: string; type?: CardType; position?: string; content?: unknown; baseRevision?: number }[]
  /** CREATE_NOTE of a project, blog or post (ADR-0052) */
  noteKind?: NoteKind
}

/** An operation waiting for the server, or one it refused (shown as needing attention). */
export interface OutboxEntry {
  op: SyncOp
  state: 'PENDING' | 'ATTENTION'
  message: string | null
  attempts: number
  createdAt: string
}
