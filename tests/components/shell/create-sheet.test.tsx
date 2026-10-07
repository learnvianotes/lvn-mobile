import { act, fireEvent, screen } from '@testing-library/react-native'
import { BackHandler } from 'react-native'
import { CreateSheet } from '@/features/shell/CreateSheet'
import { renderInApp } from '../../support/render'

jest.mock('@/lib/haptics', () => ({ haptic: { tick: jest.fn(), press: jest.fn(), success: jest.fn() } }))

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
    const { rerender } = await renderInApp(<CreateSheet open onClose={onClose} />)
    expect(listeners).toHaveLength(1)
    let handled = false
    await act(async () => { handled = listeners[0]!() })
    expect(handled).toBe(true)
    expect(onClose).toHaveBeenCalledTimes(1)
    await rerender(<CreateSheet open={false} onClose={onClose} />)
    expect(listeners).toHaveLength(0)
  })
})
