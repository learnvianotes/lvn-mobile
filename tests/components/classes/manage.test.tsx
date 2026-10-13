import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen, within } from '@testing-library/react-native'
import { router } from 'expo-router'
import { Alert } from 'react-native'
import { ClassesSection } from '@/features/classes/ClassesSection'
import { ClassScreen } from '@/features/classes/ClassScreen'
import { NewClassScreen } from '@/features/classes/NewClassScreen'
import { createApolloClient } from '@/lib/apollo'
import { mockApi, viewer } from '../../support/api'
import { renderInApp } from '../../support/render'

/** A teacher runs a class from the phone (lvn-backend ADR-0046): starting it, roles, handing it over, a new code, deleting it. */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }))
jest.mock('@/features/notes/store/db', () => ({ listNotes: jest.fn(async () => []), subscribe: () => () => {} }))

const CLASS = '01920000-0000-7000-8000-0000000c0001'
const can = (over: Record<string, boolean> = {}) => ({ __typename: 'ClassroomActions', publishQuiz: false, requestJoin: false, acceptInvite: false, review: true, post: true, manage: true, leave: false, ...over })
const classroom = (over: Record<string, unknown> = {}) => ({ __typename: 'Classroom', id: CLASS, name: 'Physics 9A', description: 'Mechanics', memberCount: 3, viewerRole: 'TEACHER', teacher: { __typename: 'User', id: 't1', displayName: 'Meera Iyer' }, createdAt: '2026-10-01T10:00:00.000Z', joinCode: 'K7PQ2MXA', viewerRequestId: null, viewerInviteId: null, viewerCan: can(), ...over })
const member = (id: string, displayName: string, role: string) => ({ __typename: 'ClassroomMember', role, joinedAt: '2026-10-01T10:00:00.000Z', user: { __typename: 'User', id, displayName, handle: displayName.split(' ')[0]!.toLowerCase() } })
const people = (list: unknown[], viewerRole = 'TEACHER') => ({ data: { classroom: { __typename: 'Classroom', id: CLASS, viewerRole, members: list, joinRequests: [] } } })
const noPosts = { data: { classroom: { __typename: 'Classroom', id: CLASS, posts: { __typename: 'ClassroomPostConnection', edges: [], pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: null } } } } }
const ok = (name: string, extra: Record<string, unknown> = {}) => ({ data: { [name]: { __typename: 'Payload', userErrors: [], ...extra } } })
const inApollo = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)
const confirmAll = () => jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.find((b) => b.style === 'destructive')?.onPress?.())

beforeEach(() => jest.clearAllMocks())

it('teachers see New class in Community and start one; students are told who starts classes', async () => {
  const api = mockApi({
    Viewer: () => ({ data: { viewer: viewer({ globalRole: 'TEACHER' }) } }),
    MyClassrooms: () => ({ data: { myClassrooms: [], myClassroomInvites: [] } }),
    CreateClassroom: () => ({ data: { createClassroom: { __typename: 'ClassroomPayload', classroom: classroom({ id: 'c9' }), userErrors: [] } } }),
  })
  await inApollo(<ClassesSection />)
  expect(await screen.findByText('No classes yet. Start one, and share its code with your students.')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'New class' }))
  expect(router.push).toHaveBeenCalledWith('/classes/new')

  await inApollo(<NewClassScreen />)
  await fireEvent.changeText(await screen.findByLabelText('Name'), 'Physics 10B')
  await fireEvent.press(screen.getByRole('button', { name: 'Create class' }))
  await screen.findByRole('button', { name: 'Create class' })
  expect(api.calls.find((c) => c.op === 'CreateClassroom')?.variables).toEqual({ input: { name: 'Physics 10B', description: null } })
  expect(router.replace).toHaveBeenCalledWith('/classes/c9')
})

it('a student cannot start a class', async () => {
  mockApi({ Viewer: () => ({ data: { viewer: viewer() } }), MyClassrooms: () => ({ data: { myClassrooms: [], myClassroomInvites: [] } }) })
  await inApollo(<ClassesSection />)
  expect(await screen.findByText("You're not in a class yet. Ask your teacher for the class code.")).toBeOnTheScreen()
  expect(screen.queryByRole('button', { name: 'New class' })).toBeNull()
  await inApollo(<NewClassScreen />)
  expect(await screen.findByText('Classes are started by teachers. Ask yours for the class code.')).toBeOnTheScreen()
})

it('the teacher makes a TA, hands the class over and removes a student', async () => {
  confirmAll()
  let list = [member('t1', 'Meera Iyer', 'TEACHER'), member('s1', 'Ravi Kumar', 'STUDENT'), member('s2', 'Asha Rao', 'STUDENT')]
  const api = mockApi({
    Classroom: () => ({ data: { classroom: classroom() } }),
    ClassroomPosts: () => noPosts,
    ClassroomPeople: () => people(list),
    SetClassroomRole: (v) => ((list = list.map((m) => (m.user.id === v.userId ? { ...m, role: String(v.role) } : m))), ok('setClassroomRole', { classroom: classroom() })),
    RemoveClassroomMember: (v) => ((list = list.filter((m) => m.user.id !== v.userId)), ok('removeClassroomMember', { classroom: { __typename: 'Classroom', id: CLASS, memberCount: 2 } })),
  })
  await inApollo(<ClassScreen id={CLASS} />)
  await fireEvent.press(await screen.findByRole('tab', { name: 'People' }))
  await screen.findByText('Ravi Kumar')
  expect(screen.queryByLabelText('Manage Meera Iyer')).toBeNull()
  await fireEvent.press(screen.getByLabelText('Manage Ravi Kumar'))
  expect(screen.getAllByRole('menuitem').map((m) => within(m).getByText(/./).props.children)).toEqual(['Make a TA', 'Hand the class to Ravi Kumar', 'Remove from the class'])
  await fireEvent.press(screen.getByRole('menuitem', { name: 'Make a TA' }))
  expect(await screen.findByText('Ravi Kumar is now a TA.')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'SetClassroomRole')?.variables).toEqual({ classroomId: CLASS, userId: 's1', role: 'TA' })

  await fireEvent.press(screen.getByLabelText('Manage Ravi Kumar'))
  await fireEvent.press(screen.getByRole('menuitem', { name: 'Hand the class to Ravi Kumar' }))
  expect(Alert.alert).toHaveBeenCalledWith('Hand the class to Ravi Kumar?', "You'll stay on as a TA.", expect.anything())
  await screen.findByText('Ravi Kumar teaches the class now. You stay on as a TA.')
  expect(api.calls.filter((c) => c.op === 'SetClassroomRole').at(-1)?.variables).toEqual({ classroomId: CLASS, userId: 's1', role: 'TEACHER' })

  await fireEvent.press(screen.getByLabelText('Manage Asha Rao'))
  await fireEvent.press(screen.getByRole('menuitem', { name: 'Remove from the class' }))
  expect(await screen.findByText('Asha Rao was removed.')).toBeOnTheScreen()
})

it('a TA invites but manages nobody and has no settings', async () => {
  mockApi({
    Classroom: () => ({ data: { classroom: classroom({ viewerRole: 'TA', viewerCan: can({ manage: false, leave: true }) }) } }),
    ClassroomPosts: () => noPosts,
    ClassroomPeople: () => people([member('t1', 'Meera Iyer', 'TEACHER'), member('s1', 'Ravi Kumar', 'STUDENT')], 'TA'),
  })
  await inApollo(<ClassScreen id={CLASS} />)
  expect(screen.queryByRole('tab', { name: 'Settings' })).toBeNull()
  await fireEvent.press(await screen.findByRole('tab', { name: 'People' }))
  await screen.findByText('Ravi Kumar')
  expect(screen.getByText('Invite as student')).toBeOnTheScreen()
  expect(screen.queryByText('Invite as TA')).toBeNull()
  expect(screen.queryByLabelText('Manage Ravi Kumar')).toBeNull()
})

it('the teacher renames the class, makes a new code and deletes it', async () => {
  confirmAll()
  let joinCode = 'K7PQ2MXA'
  const api = mockApi({
    Classroom: () => ({ data: { classroom: classroom({ joinCode }) } }),
    ClassroomPosts: () => noPosts,
    UpdateClassroom: (v) => {
      if ((v.input as { newCode: boolean }).newCode) joinCode = 'ZX9P4QRT'
      return ok('updateClassroom', { classroom: classroom({ name: (v.input as { name: string }).name, joinCode }) })
    },
    DeleteClassroom: () => ok('deleteClassroom', { ok: true }),
  })
  await inApollo(<ClassScreen id={CLASS} />)
  await fireEvent.press(await screen.findByRole('tab', { name: 'Settings' }))
  await fireEvent.changeText(screen.getByLabelText('Name'), 'Physics 9A (2026)')
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByText('Saved.')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'UpdateClassroom')?.variables).toEqual({ input: { classroomId: CLASS, name: 'Physics 9A (2026)', description: 'Mechanics', newCode: false } })

  await fireEvent.press(screen.getByRole('button', { name: 'New code' }))
  expect(Alert.alert).toHaveBeenCalledWith('Make a new code?', 'The old code and link stop working.', expect.anything())
  expect(await screen.findByText('The class has a new code.')).toBeOnTheScreen()
  expect(screen.getByLabelText('Class code ZX9P4QRT')).toBeOnTheScreen()

  await fireEvent.press(screen.getByRole('button', { name: 'Delete class' }))
  await screen.findByRole('tab', { name: 'Settings' })
  expect(api.ops()).toContain('DeleteClassroom')
  expect(router.replace).toHaveBeenCalledWith('/community')
})
