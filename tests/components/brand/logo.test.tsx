import { render, screen } from '@testing-library/react-native'
import { Logo, Wordmark } from '@/components/brand/Logo'

describe('Logo', () => {
  it('draws at the requested size and is hidden from screen readers', async () => {
    const { toJSON } = await render(<Logo size={48} />)
    const tree = toJSON() as { props: Record<string, unknown>; children: { props: Record<string, unknown> } | { props: Record<string, unknown> }[] }
    const svg = Array.isArray(tree.children) ? tree.children[0] : tree.children
    expect(tree.props.importantForAccessibility).toBe('no-hide-descendants')
    expect(svg?.props).toMatchObject({ width: 48, height: 48 })
  })
})

describe('Wordmark', () => {
  it('reads as the full name, LearnViaNotes', async () => {
    await render(<Wordmark />)
    expect(screen.getByRole('header', { name: 'LearnViaNotes' })).toBeOnTheScreen()
  })
})
