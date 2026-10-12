import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen } from '@testing-library/react-native'
import { router } from 'expo-router'
import { AccountScreen } from '@/features/auth/AccountScreen'
import { ProfileScreen } from '@/features/people/ProfileScreen'
import { SkillsScreen } from '@/features/people/SkillsScreen'
import { createApolloClient } from '@/lib/apollo'
import { mockApi, viewer } from '../../support/api'
import { renderInApp } from '../../support/render'

/** A teacher's Skills tab edited on the phone (lvn-backend ADR-0012, ADR-0044), and where the account screen leads. */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() }, Link: ({ children }: { children: React.ReactNode }) => children }))

const ME = '01920000-0000-7000-8000-00000000aaaa'
const mine = (role = 'TEACHER') => ({
  data: {
    viewer: {
      __typename: 'User', id: ME, handle: 'asharao', globalRole: role,
      teacherProfile: { __typename: 'TeacherProfile', headline: 'Teaches algorithms', bio: null, skills: [
        { __typename: 'TeacherSkill', id: 's1', kind: 'QUALIFICATION', name: 'M.Tech', detail: 'IIT Madras' },
        { __typename: 'TeacherSkill', id: 's2', kind: 'SKILL', name: 'Graph theory', detail: null },
      ] },
    },
  },
})
const inApollo = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)

beforeEach(() => jest.clearAllMocks())

it('a teacher edits, reorders, removes and adds items, saved in one go', async () => {
  const api = mockApi({
    MyTeacherProfile: () => mine(),
    UpdateTeacherProfile: () => ({ data: { updateTeacherProfile: { __typename: 'TeacherProfilePayload', profile: mine().data.viewer.teacherProfile, userErrors: [] } } }),
  })
  await inApollo(<SkillsScreen />)
  expect(await screen.findByDisplayValue('Teaches algorithms')).toBeOnTheScreen()
  await fireEvent.changeText(screen.getByLabelText('About you'), 'Ten years with second-years.')
  // Graph theory goes first, M.Tech is removed, a new experience is added with a blank one left out.
  await fireEvent.press(screen.getAllByRole('button', { name: 'Move up' })[1]!)
  await fireEvent.press(screen.getByRole('button', { name: 'Remove M.Tech' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Add an item' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Add an item' }))
  const names = screen.getAllByLabelText('Name')
  await fireEvent.changeText(names[1]!, 'Lecturer, NIT Warangal')
  await fireEvent.press(screen.getAllByRole('radio', { name: 'Experience' })[1]!)
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByText('Saved.')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'UpdateTeacherProfile')?.variables).toEqual({
    input: {
      headline: 'Teaches algorithms',
      bio: 'Ten years with second-years.',
      skills: [
        { kind: 'SKILL', name: 'Graph theory', detail: null },
        { kind: 'EXPERIENCE', name: 'Lecturer, NIT Warangal', detail: null },
      ],
    },
  })
})

it('the Skills tab is for teachers', async () => {
  mockApi({ MyTeacherProfile: () => mine('STUDENT') })
  await inApollo(<SkillsScreen />)
  expect(await screen.findByText('The Skills tab is for teachers.')).toBeOnTheScreen()
})

it('a teacher reaches it from their own profile', async () => {
  mockApi({
    Profile: () => ({
      data: {
        userByHandle: { __typename: 'User', id: ME, handle: 'asharao', displayName: 'Asha Rao', globalRole: 'TEACHER', verified: true, followerMilestone: null, followerCount: 3, followingCount: 1, profile: null, relation: null, teacherProfile: mine().data.viewer.teacherProfile, publicNotes: { __typename: 'NoteConnection', edges: [] } },
        viewer: { __typename: 'User', id: ME, verified: true },
      },
    }),
  })
  await inApollo(<ProfileScreen handle="asharao" />)
  await fireEvent.press(await screen.findByRole('tab', { name: 'Skills' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Edit your Skills tab' }))
  expect(router.push).toHaveBeenCalledWith('/skills')
})

it('the account screen leads teachers to Skills and platform admins to the queue', async () => {
  mockApi({ Viewer: () => ({ data: { viewer: viewer({ globalRole: 'TEACHER' }) } }), MyDataExports: () => ({ data: { myDataExports: [] } }) })
  await inApollo(<AccountScreen />)
  await fireEvent.press(await screen.findByRole('link', { name: /Your Skills tab/ }))
  expect(router.push).toHaveBeenCalledWith('/skills')
  expect(screen.queryByRole('link', { name: /Moderation queue/ })).toBeNull()

  mockApi({ Viewer: () => ({ data: { viewer: viewer({ globalRole: 'PLATFORM_ADMIN' }) } }), MyDataExports: () => ({ data: { myDataExports: [] } }) })
  await inApollo(<AccountScreen />)
  await fireEvent.press(await screen.findByRole('link', { name: /Moderation queue/ }))
  expect(router.push).toHaveBeenCalledWith('/admin/moderation')
})
