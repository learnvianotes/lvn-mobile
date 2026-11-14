/** A share kept on the phone until it is saved, or for 24 hours, whichever comes first. */

export const SHARE_TTL_MS = 24 * 60 * 60 * 1000

export type PendingKind = 'image' | 'heic' | 'file' | 'unsupported'

export type PendingItem = {
  key: string
  /** A copy in the app cache. Empty when the file could not be copied. */
  uri: string
  name: string
  mimeType: string
  size: number | null
  kind: PendingKind
  message: string | null
  /** Set once createUploadIntent has finished for this file. */
  fileId?: string
}

export type PendingShare = {
  id: string
  /** What the system share contained, so the same delivery is not copied twice. */
  fingerprint: string
  receivedAt: number
  text: string | null
  /** The note this share is being saved into, once chosen. */
  noteId?: string
  /** Shared words already written onto that note. */
  textSaved?: boolean
  items: PendingItem[]
}

export type ShareStorage = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

const STORAGE_KEY = 'lvn.pending-share'

export function isFresh(receivedAt: number, now: number): boolean {
  return now - receivedAt >= 0 && now - receivedAt <= SHARE_TTL_MS
}

export function fingerprintOf(input: { text?: string | null; webUrl?: string | null; files?: { path?: string | null; fileName?: string | null; size?: number | null }[] | null }): string {
  const files = (input.files ?? []).map((file) => `${file.path ?? ''}|${file.fileName ?? ''}|${file.size ?? ''}`).join('\n')
  return `${input.text ?? ''}\n${input.webUrl ?? ''}\n${files}`
}

/**
 * Where a saved share should go. Signed-out (and not-yet-registered) people stay on sign-in; the files are already
 * copied. Once they are signed in, the Save to LVN screen opens.
 */
export function shareResume(input: { phase: 'restoring' | 'signed-in' | 'signed-out'; registered: boolean; hasPending: boolean }): 'hold' | 'wait-for-sign-in' | 'open' {
  if (!input.hasPending) return 'hold'
  if (input.phase === 'restoring') return 'hold'
  if (input.phase !== 'signed-in' || !input.registered) return 'wait-for-sign-in'
  return 'open'
}

export function createShareStore(storage: ShareStorage, now: () => number = Date.now) {
  let current: PendingShare | null = null
  let loaded = false
  let receiving = false
  const listeners = new Set<() => void>()

  const emit = () => listeners.forEach((listener) => listener())

  function write(next: PendingShare | null): void {
    current = next
    loaded = true
    if (next) storage.setItem(STORAGE_KEY, JSON.stringify(next))
    else storage.removeItem(STORAGE_KEY)
    emit()
  }

  function read(): { share: PendingShare | null; expired: PendingShare | null } {
    if (!loaded) {
      loaded = true
      const raw = storage.getItem(STORAGE_KEY)
      if (raw) {
        try {
          current = JSON.parse(raw) as PendingShare
        } catch {
          current = null
          storage.removeItem(STORAGE_KEY)
        }
      }
    }
    if (current && !isFresh(current.receivedAt, now())) {
      const expired = current
      write(null)
      return { share: null, expired }
    }
    return { share: current, expired: null }
  }

  return {
    read,
    isReceiving: () => receiving,
    setReceiving(value: boolean): void {
      receiving = value
      emit()
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    save(share: PendingShare): void {
      write(share)
    },
    update(change: (share: PendingShare) => PendingShare | null): void {
      const { share } = read()
      if (!share) return
      write(change(share))
    },
    clear(): void {
      write(null)
    },
  }
}

export type ShareStore = ReturnType<typeof createShareStore>

/** The phone's store. Tests build their own with createShareStore. */
export const pendingShares: ShareStore = createShareStore({
  getItem: (key) => (typeof localStorage === 'undefined' ? null : localStorage.getItem(key)),
  setItem: (key, value) => localStorage.setItem(key, value),
  removeItem: (key) => localStorage.removeItem(key),
})
