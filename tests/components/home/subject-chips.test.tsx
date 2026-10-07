import { fireEvent, render, screen } from '@testing-library/react-native'
import { SubjectChips } from '@/features/home/SubjectChips'
import { subjects } from '@/features/home/mock'

jest.mock('@/lib/haptics', () => ({ haptic: { tick: jest.fn(), press: jest.fn(), success: jest.fn() } }))
const { haptic } = jest.requireMock('@/lib/haptics') as { haptic: Record<string, jest.Mock> }

describe('SubjectChips', () => {
  it('shows every subject with the first selected', async () => {
    await render(<SubjectChips />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(subjects.length)
    expect(tabs[0]).toBeSelected()
    expect(tabs.slice(1).every((t) => !t.props.accessibilityState?.selected)).toBe(true)
  })

  it('moves the selection with a haptic tick', async () => {
    await render(<SubjectChips />)
    await fireEvent(screen.getByText('DBMS'), 'pressIn')
    await fireEvent.press(screen.getByText('DBMS'))
    expect(screen.getAllByRole('tab')[subjects.indexOf('DBMS')]).toBeSelected()
    expect(screen.getAllByRole('tab')[0]).not.toBeSelected()
    expect(haptic.tick).toHaveBeenCalled()
  })
})
