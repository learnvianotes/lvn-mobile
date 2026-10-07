import { screen } from '@testing-library/react-native'
import { ComingSoon } from '@/features/shell/ComingSoon'
import { renderInApp } from '../../support/render'

describe('ComingSoon', () => {
  it('names the tab and the phase it ships in', async () => {
    await renderInApp(<ComingSoon title="Community" phase="Phase 3" />)
    expect(screen.getByRole('header', { name: 'Community' })).toBeOnTheScreen()
    expect(screen.getByText('Arrives in Phase 3. This prototype shows the Home tab.')).toBeOnTheScreen()
  })
})
