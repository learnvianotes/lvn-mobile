import { ApolloProvider } from '@apollo/client/react'
import { act, fireEvent, screen } from '@testing-library/react-native'
import { Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { GroupScreen } from '@/features/groups/GroupScreen'
import { SkillsScreen } from '@/features/people/SkillsScreen'
import { OfflineBanner } from '@/features/shell/OfflineBanner'
import { createApolloClient } from '@/lib/apollo'
import { mockApi } from '../../support/api'
import { renderInApp } from '../../support/render'

/**
 * A screen's four states (P9e): loading, failed with a Try again that asks again, empty only once data arrived, and the
 * offline strip above every screen.
 */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() }, useLocalSearchParams: () => ({}) }))
jest.mock('@/features/notes/store/db', () => ({ listNotes: jest.fn(async () => []), subscribe: () => () => {} }))
// The phone's connection, as a test sets it.
type Net = { isConnected: boolean; isInternetReachable: boolean }
let mockNet: Net = { isConnected: true, isInternetReachable: true }
let mockNetListener: ((s: Net) => void) | null = null
jest.mock('expo-network', () => ({
  getNetworkStateAsync: async () => mockNet,
  addNetworkStateListener: (listener: (s: Net) => void) => {
    mockNetListener = listener
    return { remove: () => (mockNetListener = null) }
  },
}))

const ME = '01920000-0000-7000-8000-00000000aaaa'
const GROUP = '01920000-0000-7000-8000-0000000a0001'
const offline = new Error('Network request failed')
const inApollo = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)

beforeEach(() => {
  mockNet = { isConnected: true, isInternetReachable: true }
})

it('Skills: a failed load shows no form and no Save, so nothing can overwrite the profile; Try again loads it', async () => {
  let down = true
  const api = mockApi({
    MyTeacherProfile: () =>
      down
        ? offline
        : { data: { viewer: { __typename: 'User', id: ME, handle: 'asharao', globalRole: 'TEACHER', teacherProfile: { __typename: 'TeacherProfile', headline: 'Teaches algorithms', bio: null, drafts: [], skills: [] } } } },
    MySkillsImport: () => ({ data: { mySkillsImport: { __typename: 'SkillsImport', allowed: true, sources: ['GITHUB'], identities: [] } } }),
  })
  await inApollo(<SkillsScreen />)
  expect(await screen.findByText('Your Skills tab could not load. Nothing was changed.')).toBeOnTheScreen()
  expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
  expect(screen.queryByLabelText('Headline')).toBeNull()

  down = false
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByDisplayValue('Teaches algorithms')).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Save' })).toBeOnTheScreen()
  expect(screen.queryByText('Your Skills tab could not load. Nothing was changed.')).toBeNull()
  expect(api.ops().filter((op) => op === 'MyTeacherProfile')).toHaveLength(2)
  expect(api.ops()).not.toContain('UpdateTeacherProfile')
})

it('a group that could not load says so (not "not available"), and Try again brings it', async () => {
  let down = true
  const can = { __typename: 'GroupActions', join: false, requestJoin: true, post: false, moderate: false, manage: false, delete: false, reviewRequests: false, leave: false, askDoubt: false, inviteMentor: false, acceptMentorInvite: false }
  const group = { __typename: 'Group', moderationWarning: null, id: GROUP, type: 'COMMUNITY', viewerMentorInviteId: null, pictureUrl: null, name: 'Algorithms study', description: 'Weekly problems', privacy: 'PUBLIC', joinPolicy: 'APPROVAL', memberCount: 12, viewerRole: null, createdAt: '2026-10-01T10:00:00.000Z', viewerRequestId: null, owner: { __typename: 'User', id: 'o1', displayName: 'Meera Iyer' }, viewerCan: can }
  const api = mockApi({ Group: () => (down ? offline : { data: { group } }) })
  await inApollo(<GroupScreen id={GROUP} />)
  expect(await screen.findByText('This group could not load.')).toBeOnTheScreen()
  expect(screen.queryByText('This group is not available.')).toBeNull()
  // A failed load is not a removed group: the owner's notice is not asked for.
  expect(api.ops()).not.toContain('RemovedGroup')

  down = false
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText('Algorithms study')).toBeOnTheScreen()
  expect(screen.getByText('Ask to join')).toBeOnTheScreen()
})

/** What a screen under the strip reads as its top inset. */
function TopInset() {
  return <Text>{`top ${useSafeAreaInsets().top}`}</Text>
}

it('offline, a strip says so above the screens, which then sit right under it', async () => {
  await renderInApp(
    <OfflineBanner>
      <TopInset />
    </OfflineBanner>,
  )
  expect(screen.getByText('top 24')).toBeOnTheScreen()
  expect(screen.queryByText("You're offline. Showing what was saved on this phone.")).toBeNull()

  await act(async () => mockNetListener?.({ isConnected: true, isInternetReachable: false }))
  expect(screen.getByText("You're offline. Showing what was saved on this phone.")).toBeOnTheScreen()
  expect(screen.getByText('top 0')).toBeOnTheScreen()

  await act(async () => mockNetListener?.({ isConnected: true, isInternetReachable: true }))
  expect(screen.queryByText("You're offline. Showing what was saved on this phone.")).toBeNull()
  expect(screen.getByText('top 24')).toBeOnTheScreen()
})

it('already offline when the app opens: the strip shows at once; signed out, it does not', async () => {
  mockNet = { isConnected: false, isInternetReachable: false }
  await renderInApp(<OfflineBanner />)
  expect(await screen.findByText("You're offline. Showing what was saved on this phone.")).toBeOnTheScreen()

  await renderInApp(<OfflineBanner enabled={false} />)
  expect(screen.queryByText("You're offline. Showing what was saved on this phone.")).toBeNull()
})
