import { ApolloProvider } from '@apollo/client/react'
import { screen } from '@testing-library/react-native'
import { HomeScreen } from '@/features/home/HomeScreen'
import { createApolloClient } from '@/lib/apollo'
import { mockApi } from '../../support/api'
import { renderInApp } from '../../support/render'

// The header's bell asks for the unread count (lvn-backend ADR-0042); no live socket in tests.
jest.mock('@/features/notifications/live', () => ({ useLive: jest.fn() }))

describe('HomeScreen', () => {
  it('lays out the Home tab sections in order', async () => {
    mockApi({ UnreadNotificationCount: () => ({ data: { unreadNotificationCount: 0 } }) })
    await renderInApp(
      <ApolloProvider client={createApolloClient()}>
        <HomeScreen />
      </ApolloProvider>,
    )
    const headers = screen.getAllByRole('header').map((h) => h.props.accessibilityLabel ?? h.props.children)
    expect(headers).toEqual(expect.arrayContaining(['Your rhythm', 'Continue learning', 'Recommended for you']))
    expect(screen.getByText('This week')).toBeOnTheScreen()
    expect(screen.getByText('See all')).toBeOnTheScreen()
  })
})
