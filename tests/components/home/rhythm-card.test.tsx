import { fireEvent, render, screen } from '@testing-library/react-native'
import { RhythmCard } from '@/features/home/RhythmCard'

jest.mock('@/lib/haptics', () => ({ haptic: { tick: jest.fn(), press: jest.fn(), success: jest.fn() } }))

const { haptic } = jest.requireMock('@/lib/haptics') as { haptic: Record<string, jest.Mock> }

describe('RhythmCard (prototype)', () => {
  it('fills the Today ring with reviews and counts the day at the low bar (ADR-0030)', async () => {
    await render(<RhythmCard />)
    expect(screen.getByText('4 more reviews and today counts')).toBeOnTheScreen()
    const review = screen.getByLabelText('Review a card')
    for (let i = 0; i < 3; i++) await fireEvent.press(review)
    expect(haptic.tick).toHaveBeenCalledTimes(3)
    expect(screen.queryByText('Day counted')).toBeNull()
    await fireEvent.press(review)
    expect(haptic.success).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Day counted')).toBeOnTheScreen()
    expect(screen.getByText(/3 of 4 planned days this week/)).toBeOnTheScreen()
  })

  it('describes the ring for screen readers', async () => {
    await render(<RhythmCard />)
    expect(screen.getByLabelText('Today: 6 of 20 reviews. 4 more to count today.')).toBeOnTheScreen()
  })
})
