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
    mockApi({
      UnreadNotificationCount: () => ({ data: { unreadNotificationCount: 0 } }),
      Viewer: () => new Error('not here'),
      Rhythm: () => new Error('not here'),
      Exams: () => ({ data: { exams: [] } }),
      Recommendations: () => ({ data: { recommendations: [{ __typename: 'Recommendation', resource: null, kind: 'CONTINUE_NOTE', score: 55, reason: 'You were reading this on Monday, 12 October', noteTitle: 'Dijkstra', topicKey: null, topicTitle: null, note: { __typename: 'Note', id: '01920000-0000-7000-8000-00000000a001' }, topic: null }] } }),
    })
    await renderInApp(
      <ApolloProvider client={createApolloClient()}>
        <HomeScreen />
      </ApolloProvider>,
    )
    expect(await screen.findByText('Dijkstra')).toBeOnTheScreen()
    const headers = screen.getAllByRole('header').map((h) => h.props.accessibilityLabel ?? h.props.children)
    expect(headers).toEqual(expect.arrayContaining(['Your rhythm', 'Continue learning', 'Recommended for you']))
    expect(screen.getByText('This week')).toBeOnTheScreen()
    expect(screen.getByText('See all')).toBeOnTheScreen()
  })
})
