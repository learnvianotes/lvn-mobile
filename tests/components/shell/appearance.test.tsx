import { fireEvent, screen } from '@testing-library/react-native'
import { AppearanceButton } from '@/features/shell/AppearanceButton'
import { PublicHeader } from '@/features/shell/PublicHeader'
import { ACCENT_KEY, THEME_KEY } from '@/lib/theme/persist'
import { chooseAccent, chooseMode } from '@/lib/theme'
import { renderInApp } from '../../support/render'

afterEach(() => {
  chooseMode('system')
  chooseAccent('navy')
  localStorage.removeItem(THEME_KEY)
  localStorage.removeItem(ACCENT_KEY)
})

it('opens Appearance from the top bar and stores the mode and accent on the device', async () => {
  await renderInApp(<AppearanceButton />)
  await fireEvent.press(screen.getByRole('button', { name: 'Appearance' }))
  expect(screen.getByRole('header', { name: 'Appearance' })).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('radio', { name: 'Dark' }))
  await fireEvent.press(screen.getByRole('radio', { name: 'Teal' }))
  expect(localStorage.getItem(THEME_KEY)).toBe('"dark"')
  expect(localStorage.getItem(ACCENT_KEY)).toBe('"teal"')
  await fireEvent.press(screen.getByRole('button', { name: 'Close' }))
  expect(screen.queryByRole('header', { name: 'Appearance' })).toBeNull()
})

it('puts Appearance on the public top bar', async () => {
  await renderInApp(<PublicHeader />)
  expect(screen.getByRole('button', { name: 'Appearance' })).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Browse' })).toBeOnTheScreen()
})
