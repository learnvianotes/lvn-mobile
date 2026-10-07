import { fireEvent, render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'
import { PressScale } from '@/features/shell/PressScale'

jest.mock('@/lib/haptics', () => ({ haptic: { tick: jest.fn(), press: jest.fn(), success: jest.fn() } }))
const { haptic } = jest.requireMock('@/lib/haptics') as { haptic: Record<string, jest.Mock> }

afterEach(() => jest.clearAllMocks())

describe('PressScale', () => {
  it('ticks on press-in and passes presses through', async () => {
    const onPress = jest.fn()
    const onPressIn = jest.fn()
    await render(<PressScale accessibilityRole="button" accessibilityLabel="Go" onPress={onPress} onPressIn={onPressIn}><Text>Go</Text></PressScale>)
    const button = screen.getByRole('button', { name: 'Go' })
    await fireEvent(button, 'pressIn')
    await fireEvent.press(button)
    expect(haptic.tick).toHaveBeenCalled()
    expect(onPressIn).toHaveBeenCalled()
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('uses the press haptic when asked', async () => {
    await render(<PressScale feedback="press" accessibilityLabel="Create"><Text>+</Text></PressScale>)
    await fireEvent(screen.getByLabelText('Create'), 'pressIn')
    expect(haptic.press).toHaveBeenCalledTimes(1)
    expect(haptic.tick).not.toHaveBeenCalled()
  })

  it('stays silent with feedback="none"', async () => {
    await render(<PressScale feedback="none" accessibilityLabel="Search"><Text>Search</Text></PressScale>)
    await fireEvent(screen.getByLabelText('Search'), 'pressIn')
    await fireEvent(screen.getByLabelText('Search'), 'pressOut')
    expect(haptic.tick).not.toHaveBeenCalled()
    expect(haptic.press).not.toHaveBeenCalled()
  })
})
