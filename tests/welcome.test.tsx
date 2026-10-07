import { fireEvent, render, screen } from '@testing-library/react-native'
import { Linking } from 'react-native'
import Welcome from '@/app/index'

jest.mock('@/lib/env', () => ({ env: { EXPO_PUBLIC_APP_ENV: 'sandbox', EXPO_PUBLIC_WEB_URL: 'https://sandbox.learnvianotes.in' } }))

describe('Welcome', () => {
  it('opens the web notes and shows the environment outside production', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
    await render(<Welcome />)
    expect(screen.getByRole('header', { name: 'LearnViaNotes' })).toBeOnTheScreen()
    expect(screen.getByTestId('env-badge')).toHaveTextContent('sandbox')
    await fireEvent.press(screen.getByRole('link', { name: 'Read the notes' }))
    expect(open).toHaveBeenCalledWith('https://sandbox.learnvianotes.in/core')
  })
})
