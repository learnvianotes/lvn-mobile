import { SHARE_TTL_MS, createShareStore, fingerprintOf, isFresh, type PendingShare, type ShareStorage } from '@/features/share/pending'

function memory(): ShareStorage & { raw: Map<string, string> } {
  const raw = new Map<string, string>()
  return {
    raw,
    getItem: (key) => raw.get(key) ?? null,
    setItem: (key, value) => void raw.set(key, value),
    removeItem: (key) => void raw.delete(key),
  }
}

const share = (receivedAt: number): PendingShare => ({
  id: 's1',
  fingerprint: 'fp',
  receivedAt,
  text: 'hello',
  items: [{ key: 'a', uri: 'file:///cache/a.jpg', name: 'a.jpg', mimeType: 'image/jpeg', size: 10, kind: 'image', message: null }],
})

describe('the pending share', () => {
  it('saves, updates and clears a share, and drops one that is older than 24 hours', () => {
    let now = 1_000
    const storage = memory()
    const store = createShareStore(storage, () => now)
    expect(store.read()).toEqual({ share: null, expired: null })
    store.save(share(now))
    expect(store.read().share?.text).toBe('hello')

    now += SHARE_TTL_MS
    expect(isFresh(1_000, now)).toBe(true)
    now += 1
    const expired = store.read()
    expect(expired.share).toBeNull()
    expect(expired.expired?.id).toBe('s1')
    expect(storage.raw.size).toBe(0)

    now = 5_000
    store.save(share(now))
    store.update((current) => ({ ...current, noteId: 'n1', textSaved: true }))
    expect(store.read().share).toMatchObject({ noteId: 'n1', textSaved: true })
    store.clear()
    expect(store.read().share).toBeNull()
  })

  it('ignores a stored share that is not JSON, and tells listeners when one arrives', () => {
    const storage = memory()
    storage.setItem('lvn.pending-share', '{')
    const store = createShareStore(storage, () => 10)
    const seen: (string | null)[] = []
    store.subscribe(() => seen.push(store.read().share?.id ?? null))
    expect(store.read().share).toBeNull()
    store.save(share(10))
    expect(seen).toEqual(['s1'])
  })

  it('fingerprints the same delivery the same way', () => {
    const one = fingerprintOf({ text: 'hi', webUrl: null, files: [{ path: 'content://1', fileName: 'a.pdf', size: 4 }] })
    const two = fingerprintOf({ text: 'hi', webUrl: null, files: [{ path: 'content://1', fileName: 'a.pdf', size: 4 }] })
    const other = fingerprintOf({ text: 'hi', webUrl: 'https://example.com', files: [] })
    expect(one).toBe(two)
    expect(one).not.toBe(other)
  })
})
