import { freeze, merge, stale } from '@/features/notes/sync/plan'
import type { LocalCard, LocalNote } from '@/features/notes/model/types'

/** The pure half of offline sync (lvn-backend §13.2): what goes into the outbox, and how pulls are merged. */

const text = (s: string) => ({ doc: { type: 'doc', content: s ? [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] : [] } })
const note = (over: Partial<LocalNote> = {}): LocalNote => ({ id: 'n1', title: 'Heaps', ownerId: 'u1', ownerName: 'Asha', access: 'OWNER', visibility: 'PRIVATE', publishedAt: null, deletedAt: null, updatedAt: '2026-10-09T10:00:00.000Z', localOnly: false, titleDirty: false, pendingTrash: null, ...over })
const card = (id: string, over: Partial<LocalCard> = {}): LocalCard => ({ id, noteId: 'n1', type: 'text', position: `a${id}`, revision: 3, content: text(id), dirty: false, deleted: false, ...over })
let n = 0
const ids = () => `op-${++n}`

describe('freezing changes into the outbox', () => {
  beforeEach(() => (n = 0))

  it('creates a note written here with its cards, then trash or restore follows', () => {
    const { ops, frozenCardIds } = freeze(note({ localOnly: true, pendingTrash: null }), [card('1', { revision: null, dirty: true }), card('2', { revision: null, deleted: true })], ids)
    expect(ops).toEqual([{ clientOpId: 'op-1', kind: 'CREATE_NOTE', noteId: 'n1', title: 'Heaps', cards: [{ id: '1', type: 'text', position: 'a1', content: text('1') }] }])
    expect(frozenCardIds.sort()).toEqual(['1', '2'])
  })

  it('sends changed cards with the revision they were based on, deletes, and the title only when it changed', () => {
    const { ops } = freeze(note({ titleDirty: true, pendingTrash: 'TRASH' }), [card('1', { dirty: true }), card('2'), card('3', { deleted: true }), card('4', { revision: null, dirty: true })], ids)
    expect(ops).toEqual([
      {
        clientOpId: 'op-1',
        kind: 'UPDATE_NOTE',
        noteId: 'n1',
        title: 'Heaps',
        ops: [
          { kind: 'UPSERT', id: '1', type: 'text', position: 'a1', content: text('1'), baseRevision: 3 },
          { kind: 'DELETE', id: '3', baseRevision: 3 },
          { kind: 'UPSERT', id: '4', type: 'text', position: 'a4', content: text('4') },
        ],
      },
      { clientOpId: 'op-2', kind: 'TRASH_NOTE', noteId: 'n1' },
    ])
  })

  it('holds back a card that is not valid yet, and sends nothing when nothing changed', () => {
    const broken = card('1', { dirty: true, type: 'heading', content: { level: 9, content: [] } })
    expect(freeze(note(), [broken], ids)).toEqual({ ops: [], frozenCardIds: [] })
    expect(freeze(note(), [card('2')], ids).ops).toEqual([])
  })
})

describe('merging what was pulled', () => {
  const pulled = { note: { id: 'n1', title: 'Heaps (server)', ownerId: 'u1', ownerName: 'Asha', access: 'OWNER' as const, visibility: 'SHARED' as const, publishedAt: null, deletedAt: null, updatedAt: '2026-10-09T11:00:00.000Z' }, cards: [{ id: '1', type: 'text' as const, position: 'a1', revision: 5, content: text('server 1') }, { id: '5', type: 'text' as const, position: 'a5', revision: 1, content: text('new on server') }] }

  it('follows the server, except changes made here and not yet answered', () => {
    const local = { note: note({ titleDirty: true, title: 'Heaps (phone)' }), cards: [card('1', { dirty: true, content: text('phone 1') }), card('2'), card('3', { deleted: true })] }
    const { note: merged, upsert, remove } = merge(local, pulled)
    expect(merged).toMatchObject({ title: 'Heaps (phone)', titleDirty: true, visibility: 'SHARED', localOnly: false })
    expect(upsert.map((c) => c.id)).toEqual(['5'])
    expect(remove).toEqual(['2'])
  })

  it('takes everything from the server when nothing is waiting here', () => {
    const { note: merged, upsert, remove } = merge({ note: note(), cards: [card('1'), card('9')] }, pulled)
    expect(merged.title).toBe('Heaps (server)')
    expect(upsert).toEqual([expect.objectContaining({ id: '1', revision: 5, content: text('server 1'), dirty: false }), expect.objectContaining({ id: '5' })])
    expect(remove).toEqual(['9'])
  })

  it('drops notes the account lost, never ones made here or with changes on their way', () => {
    const notes = [note({ id: 'a' }), note({ id: 'b' }), note({ id: 'c', localOnly: true }), note({ id: 'd' })]
    expect(stale(notes, ['a'], new Set(['d']))).toEqual(['b'])
  })
})
