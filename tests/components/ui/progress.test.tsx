import { render, screen } from '@testing-library/react-native'
import { Progress } from '@/components/ui/progress'

describe('Progress', () => {
  it('reports its value to screen readers', async () => {
    await render(<Progress value={62} accessibilityLabel="Readiness" />)
    expect(screen.getByLabelText('Readiness')).toHaveAccessibilityValue({ min: 0, max: 100, now: 62, text: '62%' })
  })

  it('treats a missing or out-of-range value as 0', async () => {
    await render(<Progress value={140} accessibilityLabel="Bad" />)
    expect(screen.getByLabelText('Bad')).toHaveAccessibilityValue({ now: 0 })
  })
})
