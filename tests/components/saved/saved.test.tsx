import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import { CardEditor } from '@/features/notes/editor/CardEditor'
import type { LocalCard } from '@/features/notes/model/types'
import { SaveNoteToggle } from '@/features/saved/SaveNoteToggle'
import { SavedScreen } from '@/features/saved/SavedScreen'
import { createApolloClient } from '@/lib/apollo'
import { mockApi } from '../../support/api'
import { renderInApp } from '../../support/render'

/**
 * Saved notes on the phone (lvn-backend ADR-0076): Save on a note and taking it off, the Saved screen with notes and
 * resources (each opens; an empty section leads somewhere), and card edits that never undo each other.
 */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true } }))
jest.mock('@/lib/haptics', () => ({ haptic: { tick: jest.fn(), press: jest.fn(), success: jest.fn() } }))

const NOTE = '01920000-0000-7000-8000-00000000a001'
const inApp = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)
const owner = { __typename: 'User', id: '01920000-0000-7000-8000-00000000bbbb', displayName: 'Ravi Kumar' }
const notes = (list: { id: string; title: string }[], next: string | null = null) => ({ data: { savedNotes: { __typename: 'NoteConnection', edges: list.map((n) => ({ __typename: 'NoteEdge', node: { __typename: 'Note', ...n, excerpt: null, owner } })), pageInfo: { __typename: 'PageInfo', hasNextPage: !!next, endCursor: next } } } })
const noResources = { data: { savedResources: { __typename: 'ResourceConnection', edges: [], pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: null } } } }

beforeEach(() => jest.clearAllMocks())

it('saves a note and takes it off again', async () => {
  let saved = false
  const payload = (name: string) => ({ data: { [name]: { __typename: 'NotePayload', note: { __typename: 'Note', id: NOTE, viewerSaved: saved }, userErrors: [] } } })
  const api = mockApi({
    NoteSaved: () => ({ data: { note: { __typename: 'Note', id: NOTE, viewerSaved: saved } } }),
    SaveNote: () => ((saved = true), payload('saveNote')),
    UnsaveNote: () => ((saved = false), payload('unsaveNote')),
  })
  await inApp(<SaveNoteToggle noteId={NOTE} />)
  await fireEvent.press(await screen.findByRole('button', { name: 'Save' }))
  expect(await screen.findByRole('button', { name: 'Saved' })).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'SaveNote')?.variables).toEqual({ noteId: NOTE })
  await fireEvent.press(screen.getByRole('button', { name: 'Saved' }))
  expect(await screen.findByRole('button', { name: 'Save' })).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'UnsaveNote')?.variables).toEqual({ noteId: NOTE })
})

it('lists saved notes, more on demand; each opens; an empty Resources section leads to the catalogue', async () => {
  const api = mockApi({
    SavedNotes: (v) => (v.after ? notes([{ id: '01920000-0000-7000-8000-00000000a0a2', title: 'Tries' }]) : notes([{ id: NOTE, title: 'Heaps' }], 'next')),
    SavedResources: () => noResources,
  })
  await inApp(<SavedScreen />)
  await fireEvent.press(await screen.findByRole('link', { name: 'Heaps' }))
  expect(router.push).toHaveBeenLastCalledWith(`/notes/${NOTE}`)
  await fireEvent.press(screen.getByRole('button', { name: 'Show more' }))
  expect(await screen.findByRole('link', { name: 'Tries' })).toBeOnTheScreen()
  expect(api.calls.filter((c) => c.op === 'SavedNotes').at(-1)?.variables).toMatchObject({ after: 'next' })
  await fireEvent.press(screen.getByRole('link', { name: /Browse resources/ }))
  expect(router.push).toHaveBeenLastCalledWith('/resources')
})

it('with no saved notes, leads to Explore to find some', async () => {
  mockApi({ SavedNotes: () => notes([]), SavedResources: () => noResources })
  await inApp(<SavedScreen />)
  await fireEvent.press(await screen.findByRole('link', { name: /Find notes/ }))
  expect(router.push).toHaveBeenLastCalledWith('/explore')
})

it('two quick edits to a flashcard, before the first is read back, keep both sides', async () => {
  const card: LocalCard = { id: 'c1', noteId: NOTE, type: 'flashcard', position: 'a0', revision: 1, content: { front: { type: 'doc', content: [] }, back: { type: 'doc', content: [] } }, dirty: false, deleted: false }
  const onChange = jest.fn()
  await renderInApp(<CardEditor card={card} onChange={onChange} />)
  await fireEvent.changeText(screen.getByLabelText('Front'), 'LIFO')
  await fireEvent.changeText(screen.getByLabelText('Back'), 'Last in, first out')
  await waitFor(() => expect(onChange).toHaveBeenCalledTimes(2))
  expect(JSON.stringify(onChange.mock.calls[1]![0])).toContain('LIFO')
  expect(JSON.stringify(onChange.mock.calls[1]![0])).toContain('Last in, first out')
})
