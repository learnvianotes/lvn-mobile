import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen } from '@testing-library/react-native'
import { router } from 'expo-router'
import { ProfileTab } from '@/features/auth/ProfileTab'
import { ProfileScreen } from '@/features/people/ProfileScreen'
import { SkillsScreen } from '@/features/people/SkillsScreen'
import { createApolloClient } from '@/lib/apollo'
import { mockApi, viewer } from '../../support/api'
import { renderInApp } from '../../support/render'

/** A teacher's Skills tab edited on the phone (lvn-backend ADR-0012, ADR-0044), and where the account screen leads. */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() }, Link: ({ children }: { children: React.ReactNode }) => children }))
jest.mock('@/features/notes/store/db', () => ({ listNotes: jest.fn(async () => []), subscribe: () => () => {} }))

const ME = '01920000-0000-7000-8000-00000000aaaa'
const mine = (role = 'TEACHER') => ({
  data: {
    viewer: {
      __typename: 'User', id: ME, handle: 'asharao', globalRole: role,
      teacherProfile: { __typename: 'TeacherProfile', headline: 'Teaches algorithms', bio: null, drafts: [], skills: [
        { __typename: 'TeacherSkill', id: 's1', kind: 'QUALIFICATION', name: 'M.Tech', detail: 'IIT Madras', source: 'MANUAL', sourceUrl: null, fetchedAt: null },
        { __typename: 'TeacherSkill', id: 's2', kind: 'SKILL', name: 'Graph theory', detail: null, source: 'MANUAL', sourceUrl: null, fetchedAt: null },
      ] },
    },
  },
})
const inApollo = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)
const skillsImport = (over: Record<string, unknown> = {}) => ({ data: { mySkillsImport: { __typename: 'SkillsImport', allowed: true, sources: ['GITHUB', 'WEBSITE'], identities: [], ...over } } })
const imported = (id: string, kind: string, name: string) => ({ __typename: 'TeacherSkill', id, kind, name, detail: null, source: 'GITHUB', sourceUrl: `https://github.com/asharao/${name}`, fetchedAt: '2026-10-01T10:00:00.000Z' })

beforeEach(() => jest.clearAllMocks())

it('a teacher edits, reorders, removes and adds items, saved in one go', async () => {
  const api = mockApi({
    MyTeacherProfile: () => mine(),
    MySkillsImport: () => skillsImport(),
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

it('the Profile tab leads teachers to Skills and platform admins to the queue', async () => {
  mockApi({ Viewer: () => ({ data: { viewer: viewer({ globalRole: 'TEACHER' }) } }), MyDataExports: () => ({ data: { myDataExports: [] } }) })
  await inApollo(<ProfileTab />)
  await fireEvent.press(await screen.findByRole('link', { name: /Your Skills tab/ }))
  expect(router.push).toHaveBeenCalledWith('/skills')
  expect(screen.queryByRole('link', { name: /Moderation queue/ })).toBeNull()

  mockApi({ Viewer: () => ({ data: { viewer: viewer({ globalRole: 'PLATFORM_ADMIN' }) } }), MyDataExports: () => ({ data: { myDataExports: [] } }) })
  await inApollo(<ProfileTab />)
  await fireEvent.press(await screen.findByRole('link', { name: /Moderation queue/ }))
  expect(router.push).toHaveBeenCalledWith('/admin/moderation')
})

it('a teacher proves a GitHub account, then publishes or discards what was imported (ADR-0077)', async () => {
  let identities: unknown[] = []
  let drafts = [imported('d1', 'PROJECT', 'tiny-os'), imported('d2', 'SKILL', 'C')]
  let published: unknown[] = []
  const identity = (verified: boolean) => ({ __typename: 'ExternalIdentity', id: 'i1', kind: 'GITHUB', value: 'asharao', code: 'lvn-ab12cd34ef', instructions: "Add lvn-ab12cd34ef to your GitHub profile's bio, then check again.", verified, checkedAt: null, fetchedAt: null, lastError: null })
  const profile = () => ({ __typename: 'TeacherProfile', headline: null, bio: null, skills: published, drafts: (identities[0] as { verified?: boolean } | undefined)?.verified ? drafts : [] })
  const api = mockApi({
    MyTeacherProfile: () => ({ data: { viewer: { __typename: 'User', id: ME, handle: 'asharao', globalRole: 'TEACHER', teacherProfile: profile() } } }),
    MySkillsImport: () => skillsImport({ identities }),
    AddExternalIdentity: () => ((identities = [identity(false)]), { data: { addExternalIdentity: { __typename: 'ExternalIdentityPayload', identity: identities[0], userErrors: [] } } }),
    CheckExternalIdentity: () => ((identities = [identity(true)]), { data: { checkExternalIdentity: { __typename: 'ExternalIdentityPayload', identity: identities[0], userErrors: [] } } }),
    PublishTeacherSkills: (v) => {
      const ids = v.skillIds as string[]
      published = drafts.filter((d) => ids.includes(d.id))
      drafts = drafts.filter((d) => !ids.includes(d.id))
      return { data: { publishTeacherSkills: { __typename: 'TeacherProfilePayload', profile: profile(), userErrors: [] } } }
    },
    DiscardTeacherSkills: (v) => ((drafts = drafts.filter((d) => !(v.skillIds as string[]).includes(d.id))), { data: { discardTeacherSkills: { __typename: 'TeacherProfilePayload', profile: profile(), userErrors: [] } } }),
  })
  await inApollo(<SkillsScreen />)
  await fireEvent.changeText(await screen.findByLabelText('GitHub user name'), 'asharao')
  await fireEvent.press(screen.getByRole('button', { name: 'Add' }))
  expect(await screen.findByText('Not proven yet')).toBeOnTheScreen()
  expect(screen.getByText('lvn-ab12cd34ef')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'AddExternalIdentity')?.variables).toEqual({ input: { kind: 'GITHUB', value: 'asharao' } })
  await fireEvent.press(screen.getByRole('button', { name: 'Check' }))
  await fireEvent.press(await screen.findByRole('button', { name: 'Publish tiny-os' }))
  expect(api.calls.find((c) => c.op === 'PublishTeacherSkills')?.variables).toEqual({ skillIds: ['d1'] })
  expect(await screen.findByText('Imported, on your profile')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Discard C' }))
  expect(api.calls.find((c) => c.op === 'DiscardTeacherSkills')?.variables).toEqual({ skillIds: ['d2'] })
})
