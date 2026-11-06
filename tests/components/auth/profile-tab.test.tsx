import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen } from '@testing-library/react-native'
import { router } from 'expo-router'
import { AccountScreen } from '@/features/auth/AccountScreen'
import { ProfileTab } from '@/features/auth/ProfileTab'
import { createApolloClient } from '@/lib/apollo'
import { mockApi, viewer } from '../../support/api'
import { renderInApp } from '../../support/render'

/**
 * The Profile tab as board A draws it (lvn-backend ADR-0076): the person, their department and year, notes, followers
 * and following, then rows that each open a screen; the account itself is in Settings behind the gear.
 */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true } }))
jest.mock('@/features/notes/store/db', () => ({
  listNotes: jest.fn(async () => [{ id: 'a', access: 'OWNER' }, { id: 'b', access: 'OWNER' }, { id: 'c', access: 'VIEWER' }]),
  subscribe: () => () => {},
}))

const standing = { data: { myStanding: { __typename: 'AccountStanding', suspendedUntil: null, suspensionReason: null, canAppeal: false, warnings: [] } } }
const inApp = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)

beforeEach(() => {
  jest.clearAllMocks()
  mockApi({
    Viewer: () => ({ data: { viewer: viewer() } }),
    MyStanding: () => standing,
    ProfileTab: () => ({ data: { viewer: { __typename: 'User', id: viewer().id, followerCount: 12, followingCount: 3, profile: { __typename: 'StudentProfile', department: 'CSE', yearOfStudy: 'YEAR_3', showOnProfile: true } } } }),
    MyDataExports: () => ({ data: { myDataExports: [] } }),
  })
})

it('shows who the person is, with their notes, followers and following; each count opens its list', async () => {
  await inApp(<ProfileTab />)
  expect(await screen.findByText('Asha Rao')).toBeOnTheScreen()
  expect(screen.getByRole('header', { name: 'Appearance' })).toBeOnTheScreen()
  expect(screen.getByRole('radio', { name: 'Navy' })).toBeOnTheScreen()
  expect(screen.getByText('@asharao')).toBeOnTheScreen()
  expect(await screen.findByText('CSE · 3rd year')).toBeOnTheScreen()
  // Notes are the person's own on this phone, not ones shared with them.
  await fireEvent.press(await screen.findByRole('link', { name: '2 notes' }))
  expect(router.push).toHaveBeenLastCalledWith('/notes')
  await fireEvent.press(screen.getByRole('link', { name: '12 followers' }))
  expect(router.push).toHaveBeenLastCalledWith('/people')
  await fireEvent.press(screen.getByRole('link', { name: '3 following' }))
  expect(router.push).toHaveBeenLastCalledWith('/people')
})

it('every row opens its screen, and the gear opens Settings', async () => {
  await inApp(<ProfileTab />)
  await screen.findByText('Asha Rao')
  const rows: [string, unknown][] = [
    ['My notes', '/notes'],
    ['Saved', '/saved'],
    ['My groups', { pathname: '/community', params: { section: 'places' } }],
    ['My classrooms', { pathname: '/community', params: { section: 'places' } }],
    ['Learning history', '/history'],
    ['Exams', '/exams'],
    ['Rhythm', '/rhythm'],
    ['Review flashcards', '/review'],
    ['Resources', '/resources'],
    ['Your resources', '/resources/mine'],
    ['See your profile', '/u/asharao'],
    ['Followers, following and blocked people', '/people'],
    ['Teach on LearnViaNotes', '/teach'],
  ]
  for (const [name, href] of rows) {
    await fireEvent.press(screen.getByRole('link', { name }))
    expect(router.push).toHaveBeenLastCalledWith(href)
  }
  await fireEvent.press(screen.getByRole('button', { name: 'Settings' }))
  expect(router.push).toHaveBeenLastCalledWith('/settings')
})

it('a restricted account says some features stay off, and does not ask a parent or guardian to confirm', async () => {
  mockApi({
    Viewer: () => ({ data: { viewer: viewer({ restrictedMinor: true }) } }),
    MyStanding: () => standing,
    MyDataExports: () => ({ data: { myDataExports: [] } }),
  })
  await inApp(<AccountScreen />)
  expect(await screen.findByText('This is a restricted account. Some features stay off.')).toBeOnTheScreen()
  expect(screen.queryByText(/parent|guardian/i)).toBeNull()
})

it('Settings holds the account: notification settings, sign-out, and the way back', async () => {
  await inApp(<AccountScreen />)
  expect(await screen.findByRole('header', { name: 'Your account' })).toBeOnTheScreen()
  expect(await screen.findByRole('link', { name: 'Contact support' })).toBeOnTheScreen()
  expect(screen.getByText('support@learnvianotes.in')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('link', { name: 'Notification settings' }))
  expect(router.push).toHaveBeenLastCalledWith('/notification-settings')
  expect(screen.getByTestId('sign-out')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Back' }))
  expect(router.back).toHaveBeenCalled()
})

it('offers verification review to a platform admin and a verified teacher, and not to a manager', async () => {
  const handlers = {
    MyStanding: () => standing,
    ProfileTab: () => ({ data: { viewer: { __typename: 'User', id: viewer().id, followerCount: 12, followingCount: 3, profile: { __typename: 'StudentProfile', department: 'CSE', yearOfStudy: 'YEAR_3', showOnProfile: true } } } }),
    MyDataExports: () => ({ data: { myDataExports: [] } }),
    MyVerificationRequests: () => ({ data: { myVerificationRequests: [] } }),
  }
  mockApi({ ...handlers, Viewer: () => ({ data: { viewer: viewer({ globalRole: 'MANAGER', verified: true }) } }) })
  await inApp(<ProfileTab />)
  expect(await screen.findByText('Asha Rao')).toBeOnTheScreen()
  expect(screen.queryByRole('link', { name: 'Verification to review' })).toBeNull()

  mockApi({ ...handlers, Viewer: () => ({ data: { viewer: viewer({ globalRole: 'PLATFORM_ADMIN', verified: false, emailVerified: false, viewerNeedsVerification: null }) } }) })
  await inApp(<ProfileTab />)
  expect(await screen.findByRole('link', { name: 'Verification to review' })).toBeOnTheScreen()
  expect(screen.queryByText('Get verified')).toBeNull()

  mockApi({ ...handlers, Viewer: () => ({ data: { viewer: viewer({ globalRole: 'STUDENT', verified: false, viewerNeedsVerification: false }) } }), MyVerificationRequests: () => ({ data: { myVerificationRequests: [] } }) })
  await inApp(<ProfileTab />)
  expect(await screen.findByText('Asha Rao')).toBeOnTheScreen()
  expect(screen.queryByText('Get verified')).toBeNull()

  mockApi({ ...handlers, Viewer: () => ({ data: { viewer: viewer({ globalRole: 'TEACHER', verified: true }) } }) })
  await inApp(<ProfileTab />)
  expect(await screen.findByRole('link', { name: 'Verification to review' })).toBeOnTheScreen()
})
