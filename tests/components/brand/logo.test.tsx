import { render, screen } from '@testing-library/react-native'
import { Logo, Wordmark } from '@/components/brand/Logo'

describe('Logo', () => {
  it('draws at the requested size and is hidden from screen readers', async () => {
    const { toJSON } = await render(<Logo size={48} />)
    const svg = toJSON() as { props: Record<string, unknown> }
    expect(svg.props).toMatchObject({ width: 48, height: 48, importantForAccessibility: 'no-hide-descendants' })
  })
})

describe('Wordmark', () => {
  it('reads as the full name, LearnViaNotes', async () => {
    await render(<Wordmark />)
    expect(screen.getByRole('header', { name: 'LearnViaNotes' })).toBeOnTheScreen()
  })
})
