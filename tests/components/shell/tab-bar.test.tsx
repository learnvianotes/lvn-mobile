import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen } from '@testing-library/react-native'
import type { ComponentProps } from 'react'
import { TabBar } from '@/features/shell/TabBar'
import { createApolloClient } from '@/lib/apollo'
import { mockApi, viewer } from '../../support/api'
import { renderInApp as render } from '../../support/render'

jest.mock('@/lib/haptics', () => ({ haptic: { tick: jest.fn(), press: jest.fn(), success: jest.fn() } }))

// The create sheet asks who the viewer is (teachers also start blogs and posts).
beforeEach(() => mockApi({ Viewer: () => ({ data: { viewer: viewer() } }) }))
const renderInApp = (ui: React.ReactElement) => render(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)
const { haptic } = jest.requireMock('@/lib/haptics') as { haptic: Record<string, jest.Mock> }

type Props = ComponentProps<typeof TabBar>

function setup(index = 0, defaultPrevented = false) {
  const routes = ['index', 'explore', 'community', 'profile'].map((name) => ({ key: `${name}-key`, name, params: undefined }))
  const emitter = { emit: jest.fn(() => ({ defaultPrevented })) }
  const navigateToTab = jest.fn()
  const props = { state: { index, routes }, emitter, navigateToTab } as unknown as Props
  return { props, emitter, navigateToTab }
}

afterEach(() => jest.clearAllMocks())

describe('TabBar', () => {
  it('shows Home · Explore · Create · Community · Profile with the current tab selected', async () => {
    const { props } = setup(0)
    await renderInApp(<TabBar {...props} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((t) => t.props.accessibilityLabel)).toEqual(['Home', 'Explore', 'Community', 'Profile'])
    expect(tabs[0]).toBeSelected()
    expect(screen.getByRole('button', { name: 'Create' })).toBeOnTheScreen()
  })

  it('navigates to another tab with a haptic tick', async () => {
    const { props, emitter, navigateToTab } = setup(0)
    await renderInApp(<TabBar {...props} />)
    await fireEvent.press(screen.getByRole('tab', { name: 'Community' }))
    expect(emitter.emit).toHaveBeenCalledWith({ type: 'tabPress', target: 'community-key', canPreventDefault: true })
    expect(navigateToTab).toHaveBeenCalledWith('community-key')
    expect(haptic.tick).toHaveBeenCalledTimes(1)
  })

  it('does not navigate to the current tab or when the press is prevented', async () => {
    const { props, navigateToTab } = setup(1, true)
    await renderInApp(<TabBar {...props} />)
    await fireEvent.press(screen.getByRole('tab', { name: 'Explore' }))
    await fireEvent.press(screen.getByRole('tab', { name: 'Home' }))
    expect(navigateToTab).not.toHaveBeenCalled()
  })

  it('opens and closes the create sheet from the centre button', async () => {
    const { props } = setup(0)
    await renderInApp(<TabBar {...props} />)
    await fireEvent.press(screen.getByRole('button', { name: 'Create' }))
    expect(haptic.press).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('header', { name: 'Create' })).toBeOnTheScreen()
    // The open sheet is modal, so the tab bar behind it is hidden from screen readers (iOS accessibilityViewIsModal).
    const toggle = screen.getByRole('button', { name: 'Close create menu', includeHiddenElements: true })
    expect(screen.queryByRole('button', { name: 'Close create menu' })).toBeNull()
    await fireEvent.press(toggle)
    expect(screen.queryByRole('header', { name: 'Create' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Create' })).toBeOnTheScreen()
  })
})
