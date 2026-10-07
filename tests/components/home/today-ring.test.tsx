import { render, screen } from '@testing-library/react-native'
import { TodayRing } from '@/features/home/TodayRing'

describe('TodayRing', () => {
  it('shows the reviews done out of the full ring', async () => {
    await render(<TodayRing done={6} dayBar={10} full={20} />)
    expect(screen.getByText('6')).toBeOnTheScreen()
    expect(screen.getByText('of 20')).toBeOnTheScreen()
  })

  it('tells screen readers how many more count the day', async () => {
    await render(<TodayRing done={6} dayBar={10} full={20} />)
    expect(screen.getByRole('progressbar')).toHaveAccessibleName('Today: 6 of 20 reviews. 4 more to count today.')
  })

  it('says the day is counted once the low bar is met', async () => {
    await render(<TodayRing done={10} dayBar={10} full={20} />)
    expect(screen.getByRole('progressbar')).toHaveAccessibleName('Today: 10 of 20 reviews. Day counted.')
  })

  it('takes a custom size', async () => {
    await render(<TodayRing done={0} dayBar={10} full={20} size={80} />)
    expect(screen.getByRole('progressbar')).toHaveStyle({ width: 80, height: 80 })
  })
})
