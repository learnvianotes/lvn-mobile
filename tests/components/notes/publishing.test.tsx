import { ApolloProvider } from '@apollo/client/react'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native'
import { router } from 'expo-router'
import { Alert, Share } from 'react-native'
import { NoteScreen } from '@/features/notes/NoteScreen'
import { NotesListScreen } from '@/features/notes/NotesListScreen'
import { DetailsScreen } from '@/features/notes/publishing/DetailsScreen'
import { ShareScreen } from '@/features/notes/publishing/ShareScreen'
import { VersionsScreen } from '@/features/notes/publishing/VersionsScreen'
import type { LocalNote } from '@/features/notes/model/types'
import { syncNow } from '@/features/notes/sync/engine'
import { createApolloClient } from '@/lib/apollo'
import { mockApi } from '../../support/api'
import { renderInApp } from '../../support/render'

/**
 * Publishing from the phone (lvn-backend ADR-0052): the owner's menu and publishing, sharing and who can read a note,
 * copies, versions, folder, tags and topics, and the list's filters.
 */
const NOTE = '01920000-0000-7000-8000-00000000a001'
const ME = '01920000-0000-7000-8000-00000000aaaa'
let mockNotes: LocalNote[] = []
let mockUnsent = new Set<string>()
/** What the phone's store tells its readers after a write or a sync. */
const changed = () => mockListeners.forEach((l) => l())
const local = (over: Partial<LocalNote> = {}): LocalNote => ({ id: NOTE, title: 'Binary heaps', kind: 'NOTE', folderId: null, folderName: null, tags: [], ownerId: ME, ownerName: 'Asha Rao', access: 'OWNER', visibility: 'PRIVATE', publishedAt: null, deletedAt: null, updatedAt: new Date().toISOString(), localOnly: false, titleDirty: false, pendingTrash: null, ...over })
const doc = (s: string) => ({ doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] } })

jest.mock('@/features/notes/store/db', () => ({
  getNote: jest.fn(async (id: string) => mockNotes.find((n) => n.id === id) ?? null),
  getCards: jest.fn(async (id: string) => [{ id: 'c1', noteId: id, type: 'text', position: 'a0', revision: 1, content: { doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A heap is a tree' }] }] } }, dirty: false, deleted: false }]),
  listNotes: jest.fn(async (trash: boolean) => (trash ? [] : mockNotes)),
  excerpts: jest.fn(async () => new Map()),
  unsentNoteIds: jest.fn(async () => mockUnsent),
  outbox: jest.fn(async () => []),
  subscribe: (listener: () => void) => (mockListeners.add(listener), () => mockListeners.delete(listener)),
}))
const mockListeners = new Set<() => void>()
jest.mock('@/features/notes/store/actions', () => ({ trashNote: jest.fn(async () => {}), createNote: jest.fn(async () => 'n-new') }))
jest.mock('@/features/notes/sync/engine', () => {
  const idle = { state: 'idle', lastSyncedAt: null }
  return { syncSoon: jest.fn(), syncNow: jest.fn(async () => {}), getSyncStatus: () => idle, subscribeSyncStatus: () => () => {} }
})
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true } }))

const meta = (over: Record<string, unknown> = {}) => ({
  __typename: 'Note', id: NOTE, title: 'Binary heaps', slug: 'binary-heaps', kind: 'NOTE', visibility: 'PRIVATE', viewerAccess: 'OWNER',
  viewerCan: { __typename: 'NoteActions', edit: true, publish: true, changeVisibility: true, delete: true, share: true, fork: false },
  owner: { __typename: 'User', id: ME, displayName: 'Asha Rao', handle: 'asharao' }, folder: null, tags: [], topics: [],
  draftRevision: 3, draftUpdatedAt: '2026-10-12T10:00:00.000Z', publishedAt: null, publishedVersion: null, forkingEnabled: true,
  moderation: null, forkedFrom: null, deletedAt: null, ...over,
})
const version = (n: number) => ({ __typename: 'NoteVersion', id: `v${n}`, number: n, createdAt: '2026-10-12T10:00:00.000Z' })
const inApollo = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)
const menu = () => screen.getAllByRole('menuitem').map((m) => within(m).getByText(/./).props.children)

beforeEach(() => {
  jest.clearAllMocks()
  mockNotes = [local()]
  mockUnsent = new Set()
})

it('the owner publishes from the note’s menu, and the status follows', async () => {
  let published: ReturnType<typeof version> | null = null
  const api = mockApi({
    PhoneNoteMeta: () => ({ data: { note: meta({ publishedVersion: published }) } }),
    PublishNote: () => ((published = version(1)), { data: { publishNote: { __typename: 'NotePayload', note: meta({ publishedVersion: published, publishedAt: '2026-10-12T11:00:00.000Z' }), userErrors: [] } } }),
  })
  await inApollo(<NoteScreen id={NOTE} />)
  expect(await screen.findByLabelText('Status: Note · Private · Draft, not published')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Note actions' }))
  expect(menu()).toEqual(['Publish', 'Share and who can read it', 'Folder, tags and topics', 'Version history', 'Move to trash'])
  await fireEvent.press(screen.getByRole('menuitem', { name: 'Publish' }))
  expect(await screen.findByText('Published as version 1.')).toBeOnTheScreen()
  expect(await screen.findByLabelText('Status: Note · Private · Published: version 1')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'PublishNote')?.variables).toEqual({ noteId: NOTE })
  await fireEvent.press(screen.getByRole('button', { name: 'Note actions' }))
  expect(menu()[0]).toBe('Publish changes')
  await fireEvent.press(screen.getByRole('menuitem', { name: 'Share and who can read it' }))
  expect(router.push).toHaveBeenCalledWith(`/notes/share/${NOTE}`)
})

it('changes still on the phone are sent before anything is published', async () => {
  mockUnsent = new Set([NOTE])
  const api = mockApi({ PhoneNoteMeta: () => ({ data: { note: meta() } }) })
  await inApollo(<NoteScreen id={NOTE} />)
  await screen.findByLabelText('Status: Note · Private · Draft, not published')
  await fireEvent.press(screen.getByRole('button', { name: 'Note actions' }))
  await fireEvent.press(screen.getByRole('menuitem', { name: 'Publish' }))
  expect(await screen.findByText('Your latest changes are still on this phone. They are being sent; publish again in a moment.')).toBeOnTheScreen()
  expect(syncNow).toHaveBeenCalled()
  expect(api.ops()).not.toContain('PublishNote')
})

it('a new note asks for its standing again once it has been sent (it was queued before the server had it)', async () => {
  mockUnsent = new Set([NOTE])
  let onServer = false
  const api = mockApi({ PhoneNoteMeta: () => ({ data: { note: onServer ? meta({ kind: 'BLOG' }) : null } }) })
  await inApollo(<NoteScreen id={NOTE} />)
  await waitFor(() => expect(api.ops()).toContain('PhoneNoteMeta'))
  expect(screen.getByLabelText('Status: Note · Private')).toBeOnTheScreen()
  onServer = true
  mockUnsent = new Set()
  await act(async () => changed())
  expect(await screen.findByLabelText('Status: Blog post · Private · Draft, not published')).toBeOnTheScreen()
  expect(api.ops().filter((o) => o === 'PhoneNoteMeta')).toHaveLength(2)
})

it('a note made here and not sent yet says its other actions need a connection; the trash works offline', async () => {
  mockNotes = [local({ localOnly: true, kind: 'PROJECT' })]
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  const api = mockApi({})
  await inApollo(<NoteScreen id={NOTE} />)
  expect(await screen.findByLabelText('Status: Project · Private')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Note actions' }))
  await fireEvent.press(screen.getByRole('menuitem', { name: 'Version history' }))
  expect(alert).toHaveBeenCalledWith('This needs a connection', 'The note is still only on this phone. It is sent as soon as you are online.')
  expect(router.push).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole('button', { name: 'Note actions' }))
  await fireEvent.press(screen.getByRole('menuitem', { name: 'Move to trash' }))
  expect(alert).toHaveBeenLastCalledWith('Move to trash?', 'You can restore it from the trash for 30 days.', expect.anything())
  expect(api.ops()).not.toContain('PhoneNoteMeta')
})

it('someone reading a note that allows copies makes their own', async () => {
  mockNotes = [local({ access: 'READER', ownerId: 'u2', ownerName: 'Meera Iyer', visibility: 'SHARED' })]
  const api = mockApi({
    PhoneNoteMeta: () => ({ data: { note: meta({ viewerAccess: 'READER', viewerCan: { __typename: 'NoteActions', edit: false, publish: false, changeVisibility: false, delete: false, share: false, fork: true } }) } }),
    NoteContributors: () => ({ data: { note: { __typename: 'Note', id: NOTE, contributors: [] } } }),
    Discussion: () => ({ data: { discussion: null } }),
    ForkNote: () => ({ data: { forkNote: { __typename: 'NotePayload', note: { __typename: 'Note', id: 'n-copy' }, userErrors: [] } } }),
  })
  await inApollo(<NoteScreen id={NOTE} />)
  await fireEvent.press(await screen.findByRole('button', { name: 'Make a copy' }))
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/notes/n-copy'))
  expect(syncNow).toHaveBeenCalled()
  expect(api.calls.find((c) => c.op === 'ForkNote')?.variables).toEqual({ noteId: NOTE })
})

it('sharing: who can read it, people with what they can do, copies, and the link', async () => {
  let visibility = 'PRIVATE'
  let shares: unknown[] = []
  let forking = true
  const person = (id: string, displayName: string, role: string) => ({ __typename: 'NoteShare', role, source: 'DIRECT', createdAt: '2026-10-12T10:00:00.000Z', user: { __typename: 'User', id, displayName, handle: displayName.split(' ')[0]!.toLowerCase() } })
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction', activityType: undefined })
  const api = mockApi({
    PhoneNoteMeta: () => ({ data: { note: meta({ visibility, forkingEnabled: forking, publishedVersion: version(2) }) } }),
    NoteShares: () => ({ data: { note: { __typename: 'Note', id: NOTE, visibility, sharedWithConnections: false, shares }, viewer: { __typename: 'User', id: ME, globalRole: 'STUDENT' } } }),
    ChangeNoteVisibility: (v) => ((visibility = String(v.visibility)), { data: { changeNoteVisibility: { __typename: 'NotePayload', note: meta({ visibility, publishedVersion: version(2) }), userErrors: [] } } }),
    ShareNote: (v) => {
      shares = [person('u2', 'Ravi Kumar', String(v.role))]
      return { data: { shareNote: { __typename: 'NotePayload', note: { ...meta({ visibility, publishedVersion: version(2) }), shares }, userErrors: [] } } }
    },
    UnshareNote: () => ((shares = []), { data: { unshareNote: { __typename: 'NotePayload', note: { __typename: 'Note', id: NOTE, shares }, userErrors: [] } } }),
    SetNoteForking: (v) => ((forking = Boolean(v.enabled)), { data: { setNoteForking: { __typename: 'NotePayload', note: meta({ visibility, forkingEnabled: forking, publishedVersion: version(2) }), userErrors: [] } } }),
  })
  await inApollo(<ShareScreen id={NOTE} />)
  expect(await screen.findByText('Private notes have no link to share.')).toBeOnTheScreen()
  // Teachers alone share with all their connections.
  expect(screen.queryByLabelText('Share with all my connections')).toBeNull()

  await fireEvent.changeText(screen.getByLabelText('Handle or email'), '@ravi')
  await fireEvent.press(screen.getByRole('radio', { name: 'Can edit' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Add' }))
  expect(await screen.findByText('Ravi Kumar')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'ShareNote')?.variables).toEqual({ noteId: NOTE, person: '@ravi', role: 'EDITOR' })
  expect(screen.getByText('The note is private, so the people above cannot open it until you choose Shared or Public.')).toBeOnTheScreen()

  await fireEvent.press(screen.getByRole('radio', { name: 'Shared' }))
  await waitFor(() => expect(screen.getByRole('radio', { name: 'Shared' })).toBeChecked())
  expect(api.calls.find((c) => c.op === 'ChangeNoteVisibility')?.variables).toEqual({ noteId: NOTE, visibility: 'SHARED' })
  await fireEvent.press(screen.getByRole('button', { name: 'Send the link' }))
  expect(share).toHaveBeenCalledWith({ message: expect.stringContaining(`/notes/${NOTE}`) })

  await fireEvent.press(screen.getByRole('radio', { name: 'Public' }))
  await waitFor(() => expect(screen.getByRole('radio', { name: 'Public' })).toBeChecked())
  await fireEvent.press(screen.getByRole('button', { name: 'Send the link' }))
  expect(share).toHaveBeenLastCalledWith({ message: expect.stringContaining(`/n/binary-heaps-${NOTE}`) })

  await fireEvent(screen.getByLabelText('Let people make a copy'), 'valueChange', false)
  await waitFor(() => expect(api.calls.find((c) => c.op === 'SetNoteForking')?.variables).toEqual({ noteId: NOTE, enabled: false }))
  await fireEvent.press(screen.getByRole('button', { name: 'Remove Ravi Kumar' }))
  expect(await screen.findByText('Not shared with anyone yet.')).toBeOnTheScreen()
})

it('a note never published cannot go public yet', async () => {
  const api = mockApi({
    PhoneNoteMeta: () => ({ data: { note: meta() } }),
    NoteShares: () => ({ data: { note: { __typename: 'Note', id: NOTE, visibility: 'PRIVATE', sharedWithConnections: false, shares: [] }, viewer: { __typename: 'User', id: ME, globalRole: 'TEACHER' } } }),
  })
  await inApollo(<ShareScreen id={NOTE} />)
  await fireEvent.press(await screen.findByRole('radio', { name: 'Public' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Publish the note first: readers see the published version.')
  expect(api.ops()).not.toContain('ChangeNoteVisibility')
  expect(screen.getByLabelText('Share with all my connections')).toBeOnTheScreen()
})

it('version history: read an old version and restore it after confirming', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.at(-1)?.onPress?.())
  const v = (n: number, kind = 'PUBLISHED') => ({ __typename: 'NoteVersion', id: `v${n}`, number: n, kind, title: 'Binary heaps', createdAt: '2026-10-12T10:00:00.000Z', createdBy: { __typename: 'User', id: ME, displayName: 'Asha Rao' } })
  const api = mockApi({
    NoteVersions: () => ({ data: { note: { __typename: 'Note', id: NOTE, publishedVersion: { __typename: 'NoteVersion', id: 'v2' }, versions: { __typename: 'NoteVersionConnection', edges: [v(2), v(1, 'CONFLICT')].map((node) => ({ __typename: 'NoteVersionEdge', node })), pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: null } } } } }),
    NoteVersionPreview: () => ({ data: { note: { __typename: 'Note', id: NOTE, version: { ...v(1, 'CONFLICT'), cards: { __typename: 'CardConnection', edges: [{ __typename: 'CardEdge', node: { __typename: 'Card', id: 'old', type: 'text', content: doc('The old wording') } }] } } } } }),
    RestoreNoteVersion: () => ({ data: { restoreNoteVersion: { __typename: 'NotePayload', note: { __typename: 'Note', id: NOTE }, userErrors: [] } } }),
  })
  await inApollo(<VersionsScreen id={NOTE} />)
  expect(await screen.findByText(/readers see this one/)).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Version 1, from another device' }))
  expect(await screen.findByText('The old wording')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Restore this version' }))
  expect(Alert.alert).toHaveBeenCalledWith('Restore version 1?', 'Your current draft is kept as a version first.', expect.anything())
  await waitFor(() => expect(router.back).toHaveBeenCalled())
  expect(syncNow).toHaveBeenCalled()
  expect(api.calls.find((c) => c.op === 'RestoreNoteVersion')?.variables).toEqual({ noteId: NOTE, versionId: 'v1' })
})

it('details: a folder, tags and a topic found by search, saved then pulled', async () => {
  const api = mockApi({
    PhoneNoteMeta: () => ({ data: { note: meta({ tags: [{ __typename: 'Tag', id: 't1', name: 'exam' }] }) } }),
    Organise: () => ({ data: { myFolders: [{ __typename: 'Folder', id: 'f1', name: 'Algorithms', parentId: null, noteCount: 3 }, { __typename: 'Folder', id: 'f2', name: 'Trees', parentId: 'f1', noteCount: 1 }], myTags: [] } }),
    FindTopics: () => ({ data: { findTopics: [{ __typename: 'Topic', id: 'tp1', title: 'Heaps', origin: 'CURATED', subject: { __typename: 'Subject', id: 's1', title: 'Data structures' } }] } }),
    UpdateNoteDetails: () => ({ data: { updateNoteDraft: { __typename: 'UpdateNoteDraftPayload', note: meta(), userErrors: [] } } }),
  })
  await inApollo(<DetailsScreen id={NOTE} />)
  expect(await screen.findByDisplayValue('exam')).toBeOnTheScreen()
  await fireEvent.press(await screen.findByRole('radio', { name: '  Trees' }))
  await fireEvent.changeText(screen.getByLabelText('Tags'), 'exam, revision')
  await fireEvent.changeText(screen.getByLabelText('Search topics'), 'heap')
  await fireEvent.press(await screen.findByRole('button', { name: 'Add Heaps' }))
  expect(screen.getByRole('button', { name: 'Remove Heaps' })).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(router.back).toHaveBeenCalled())
  expect(api.calls.find((c) => c.op === 'UpdateNoteDetails')?.variables).toEqual({ input: { noteId: NOTE, folderId: 'f2', tagNames: ['exam', 'revision'], topicIds: ['tp1'] } })
  expect(syncNow).toHaveBeenCalled()
})

it('the list filters by what notes are, their folder and their tags, offline', async () => {
  mockNotes = [
    local({ id: 'a', title: 'Heaps', folderId: 'f1', folderName: 'Algorithms', tags: ['exam'] }),
    local({ id: 'b', title: 'Rover', kind: 'PROJECT' }),
    local({ id: 'c', title: 'Graphs, shared', access: 'READER', ownerName: 'Meera Iyer', tags: ['exam'] }),
  ]
  mockApi({})
  await inApollo(<NotesListScreen />)
  await screen.findByText('Rover')
  expect(screen.getAllByRole('tab').map((t) => within(t).getByText(/./).props.children)).toEqual(['All', 'Shared with me', 'Projects', 'Algorithms', '#exam'])
  expect(screen.getByText('Project')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('tab', { name: 'Projects' }))
  expect(screen.queryByText('Heaps')).toBeNull()
  expect(screen.getByText('Rover')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('tab', { name: '#exam' }))
  expect(screen.getByText('Heaps')).toBeOnTheScreen()
  expect(screen.getByText('Graphs, shared')).toBeOnTheScreen()
  expect(screen.queryByText('Rover')).toBeNull()
  await fireEvent.press(screen.getByRole('tab', { name: 'Algorithms' }))
  expect(screen.getByText('Heaps')).toBeOnTheScreen()
  expect(screen.queryByText('Graphs, shared')).toBeNull()
})
