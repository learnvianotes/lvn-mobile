import { ApolloProvider } from '@apollo/client/react'
import { act, fireEvent, screen } from '@testing-library/react-native'
import { router } from 'expo-router'
import { BackHandler } from 'react-native'
import { CreateSheet } from '@/features/shell/CreateSheet'
import { createNote } from '@/features/notes/store/actions'
import { createApolloClient } from '@/lib/apollo'
import { mockApi, viewer } from '../../support/api'
import { renderInApp as render } from '../../support/render'

jest.mock('@/lib/haptics', () => ({ haptic: { tick: jest.fn(), press: jest.fn(), success: jest.fn() } }))
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))
jest.mock('@/features/notes/store/actions', () => ({ createNote: jest.fn(async () => 'n-new'), setTitle: jest.fn(async () => undefined), addCard: jest.fn() }))

let role = 'STUDENT'
beforeEach(() => {
  jest.clearAllMocks()
  role = 'STUDENT'
  mockApi({ Viewer: () => ({ data: { viewer: viewer({ globalRole: role }) } }) })
})
const renderInApp = (ui: React.ReactElement) => render(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)

const OPTIONS = ['Note', 'Quick note', 'Voice note', 'Photo', 'Upload', 'Quiz', 'Flashcards']

describe('CreateSheet', () => {
  it('renders nothing while closed', async () => {
    await renderInApp(<CreateSheet open={false} onClose={jest.fn()} />)
    expect(screen.queryByRole('header', { name: 'Create' })).toBeNull()
  })

  it('offers every create option of spec §13.1 when open', async () => {
    await renderInApp(<CreateSheet open onClose={jest.fn()} />)
    expect(screen.getByRole('header', { name: 'Create' })).toBeOnTheScreen()
    for (const label of OPTIONS) expect(screen.getByRole('button', { name: label })).toBeOnTheScreen()
  })

  it('closes from an option and from the backdrop', async () => {
    const onClose = jest.fn()
    await renderInApp(<CreateSheet open onClose={onClose} />)
    await fireEvent.press(screen.getByRole('button', { name: 'Quiz' }))
    await fireEvent.press(screen.getByLabelText('Close'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('closes on the Android back button while open, and only then', async () => {
    const listeners: (() => boolean)[] = []
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
      listeners.push(handler as () => boolean)
      return { remove: () => listeners.splice(listeners.indexOf(handler as () => boolean), 1) }
    })
    const onClose = jest.fn()
    const client = createApolloClient()
    const { rerender } = await render(<ApolloProvider client={client}><CreateSheet open onClose={onClose} /></ApolloProvider>)
    expect(listeners).toHaveLength(1)
    let handled = false
    await act(async () => { handled = listeners[0]!() })
    expect(handled).toBe(true)
    expect(onClose).toHaveBeenCalledTimes(1)
    await rerender(<ApolloProvider client={client}><CreateSheet open={false} onClose={onClose} /></ApolloProvider>)
    expect(listeners).toHaveLength(0)
  })

  it('everyone starts a project; teachers also a blog post or a post (ADR-0052)', async () => {
    await renderInApp(<CreateSheet open onClose={jest.fn()} />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Project' }))
    expect(createNote).toHaveBeenCalledWith({ id: '', name: '' }, 'PROJECT')
    expect(router.push).toHaveBeenCalledWith('/notes/n-new')
    expect(screen.queryByRole('button', { name: 'Blog post' })).toBeNull()

    role = 'TEACHER'
    mockApi({ Viewer: () => ({ data: { viewer: viewer({ globalRole: role }) } }) })
    await renderInApp(<CreateSheet open onClose={jest.fn()} />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Blog post' }))
    expect(createNote).toHaveBeenLastCalledWith({ id: '', name: '' }, 'BLOG')
    expect(screen.getByRole('button', { name: 'Post' })).toBeOnTheScreen()
  })

  it('a plain note has no kind', async () => {
    await renderInApp(<CreateSheet open onClose={jest.fn()} />)
    await fireEvent.press(screen.getByRole('button', { name: 'Note' }))
    expect(createNote).toHaveBeenCalledWith({ id: '', name: '' }, undefined)
  })
})
