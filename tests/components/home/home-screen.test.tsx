import { screen } from '@testing-library/react-native'
import { HomeScreen } from '@/features/home/HomeScreen'
import { renderInApp } from '../../support/render'

describe('HomeScreen', () => {
  it('lays out the Home tab sections in order', async () => {
    await renderInApp(<HomeScreen />)
    const headers = screen.getAllByRole('header').map((h) => h.props.accessibilityLabel ?? h.props.children)
    expect(headers).toEqual(expect.arrayContaining(['Your rhythm', 'Continue learning', 'Recommended for you']))
    expect(screen.getByText('This week')).toBeOnTheScreen()
    expect(screen.getByText('See all')).toBeOnTheScreen()
  })
})
