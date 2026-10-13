import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import { Share } from 'react-native'
import { ClassesSection } from '@/features/classes/ClassesSection'
import { ClassScreen } from '@/features/classes/ClassScreen'
import { JoinClassScreen } from '@/features/classes/JoinClassScreen'
import { createApolloClient } from '@/lib/apollo'
import { mockApi } from '../../support/api'
import { renderInApp } from '../../support/render'

/** Classes on the phone (lvn-backend ADR-0046): invites and codes in Community, joining by code, a class for students and staff. */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }))
jest.mock('@/features/notes/store/db', () => ({ listNotes: jest.fn(async () => [{ id: 'n1', title: 'Kinematics summary' }]), subscribe: () => () => {} }))

const CLASS = '01920000-0000-7000-8000-0000000c0001'
const teacherRef = { __typename: 'User', id: 't1', displayName: 'Meera Iyer' }
const can = (over: Record<string, boolean> = {}) => ({ __typename: 'ClassroomActions', publishQuiz: false, requestJoin: false, acceptInvite: false, review: false, post: false, manage: false, leave: false, ...over })
const classroom = (over: Record<string, unknown> = {}) => ({ __typename: 'Classroom', id: CLASS, name: 'Physics 9A', description: null, memberCount: 31, viewerRole: null, teacher: teacherRef, createdAt: '2026-10-01T10:00:00.000Z', joinCode: null, viewerRequestId: null, viewerInviteId: null, viewerCan: can(), ...over })
const asTeacher = () => classroom({ viewerRole: 'TEACHER', joinCode: 'K7PQ2MXA', viewerCan: can({ review: true, post: true, manage: true }) })
const doc = (s: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] })
const post = (id: string, text: string, over: Record<string, unknown> = {}) => ({ __typename: 'ClassroomPost', moderation: 'OK', moderationReason: null, moderationCanAppeal: false, id, body: doc(text), createdAt: new Date().toISOString(), viewerCanDelete: false, author: { __typename: 'User', id: 't1', displayName: 'Meera Iyer', handle: 'meera' }, discussion: { __typename: 'Discussion', commentCount: 0 }, ...over })
const posts = (nodes: unknown[]) => ({ data: { classroom: { __typename: 'Classroom', id: CLASS, posts: { __typename: 'ClassroomPostConnection', edges: nodes.map((node) => ({ __typename: 'ClassroomPostEdge', node })), pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: null } } } } })
const inApollo = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)

beforeEach(() => jest.clearAllMocks())

it('Community shows invites to answer, your classes, and takes a class code', async () => {
  let invited = true
  const api = mockApi({
    MyClassrooms: () => ({
      data: {
        myClassrooms: invited ? [] : [{ __typename: 'Classroom', id: CLASS, name: 'Physics 9A', description: null, memberCount: 31, viewerRole: 'STUDENT', teacher: teacherRef }],
        myClassroomInvites: invited ? [{ __typename: 'ClassroomInviteItem', id: 'inv1', role: 'STUDENT', expiresAt: '2026-10-26T10:00:00.000Z', classroom: { __typename: 'ClassroomPreview', id: CLASS, name: 'Physics 9A', teacher: teacherRef }, invitedBy: teacherRef }] : [],
      },
    }),
    AnswerClassroomInvite: () => ((invited = false), { data: { answerClassroomInvite: { __typename: 'ClassroomPayload', classroom: classroom({ viewerRole: 'STUDENT' }), userErrors: [] } } }),
  })
  await inApollo(<ClassesSection />)
  expect(await screen.findByText('Meera Iyer invited you as Student')).toBeOnTheScreen()
  await fireEvent.press(screen.getByText('Accept'))
  await fireEvent.press(await screen.findByLabelText('Physics 9A'))
  expect(router.push).toHaveBeenCalledWith(`/classes/${CLASS}`)
  expect(api.calls.find((c) => c.op === 'AnswerClassroomInvite')?.variables).toEqual({ inviteId: 'inv1', accept: true })
  await fireEvent.changeText(screen.getByLabelText('Class code'), 'k7pq-2mxa')
  await fireEvent.press(screen.getByLabelText('Find class'))
  expect(router.push).toHaveBeenCalledWith('/classes/join/K7PQ2MXA?via=code')
})

it('a code shows the class by name and teacher, and the student asks to join', async () => {
  let asked = false
  const api = mockApi({
    ClassroomByCode: (v) => ({ data: { classroomByCode: v.code === 'K7PQ2MXA' ? { __typename: 'ClassroomPreview', id: CLASS, name: 'Physics 9A', viewerRole: null, viewerRequestId: asked ? 'jr1' : null, teacher: teacherRef } : null } }),
    RequestToJoinClassroom: () => ((asked = true), { data: { requestToJoinClassroom: { __typename: 'ClassroomPayload', classroom: classroom({ viewerRequestId: 'jr1' }), userErrors: [] } } }),
  })
  await inApollo(<JoinClassScreen code="k7pq2mxa" via="LINK" />)
  expect(await screen.findByText('Teacher: Meera Iyer')).toBeOnTheScreen()
  await fireEvent.press(screen.getByText('Ask to join'))
  expect(await screen.findByText('Your request is waiting for your teacher.')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'RequestToJoinClassroom')?.variables).toEqual({ code: 'K7PQ2MXA', via: 'LINK' })
})

it('an unknown code says so', async () => {
  mockApi({ ClassroomByCode: () => ({ data: { classroomByCode: null } }) })
  await inApollo(<JoinClassScreen code="ZZZZZZZZ" via="CODE" />)
  expect(await screen.findByText('No class has that code. Check it with your teacher.')).toBeOnTheScreen()
})

it('a student reads announcements and notes, without staff tools or the code', async () => {
  mockApi({
    Classroom: () => ({ data: { classroom: classroom({ viewerRole: 'STUDENT', viewerCan: can({ leave: true }) }) } }),
    ClassroomPosts: () => posts([post('p1', 'Test on Friday')]),
    ClassroomNotes: () => ({ data: { classroom: { __typename: 'Classroom', id: CLASS, sharedNotes: { __typename: 'NoteConnection', edges: [{ __typename: 'NoteEdge', node: { __typename: 'Note', id: 'n1', title: 'Kinematics summary', publishedAt: null, owner: teacherRef } }] } } } }),
  })
  await inApollo(<ClassScreen id={CLASS} />)
  expect(await screen.findByText('Test on Friday')).toBeOnTheScreen()
  expect(screen.queryByLabelText('Write an announcement')).toBeNull()
  expect(screen.queryByText('People')).toBeNull()
  expect(screen.queryByText('Class code')).toBeNull()
  await fireEvent.press(screen.getByText('Notes'))
  expect(await screen.findByText('Kinematics summary')).toBeOnTheScreen()
  expect(screen.queryByText('Share one of your notes')).toBeNull()
})

it('the teacher shares the join link, posts, invites a TA and lets a student in', async () => {
  let list: unknown[] = []
  let pending = true
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' })
  const api = mockApi({
    Classroom: () => ({ data: { classroom: asTeacher() } }),
    ClassroomPosts: () => posts(list),
    CreateClassroomPost: () => ((list = [post('p9', 'Test on Friday', { viewerCanDelete: true })]), { data: { createClassroomPost: { __typename: 'ClassroomPayload', classroom: { __typename: 'Classroom', id: CLASS }, userErrors: [] } } }),
    ClassroomPeople: () => ({
      data: {
        classroom: {
          __typename: 'Classroom', id: CLASS, viewerRole: 'TEACHER',
          members: [{ __typename: 'ClassroomMember', role: 'TEACHER', joinedAt: '2026-10-01T10:00:00.000Z', user: { __typename: 'User', id: 'me', displayName: 'Asha Rao', handle: 'asha' } }],
          joinRequests: pending ? [{ __typename: 'ClassroomJoinRequest', id: 'jr1', via: 'CODE', createdAt: new Date().toISOString(), user: { __typename: 'User', id: 'u9', displayName: 'Kiran Das', handle: 'kiran' } }] : [],
        },
      },
    }),
    InviteToClassroom: () => ({ data: { inviteToClassroom: { __typename: 'ClassroomPayload', classroom: { __typename: 'Classroom', id: CLASS }, userErrors: [] } } }),
    ReviewClassroomJoinRequest: () => ((pending = false), { data: { reviewClassroomJoinRequest: { __typename: 'ClassroomPayload', classroom: { __typename: 'Classroom', id: CLASS, memberCount: 32 }, userErrors: [] } } }),
  })
  await inApollo(<ClassScreen id={CLASS} />)
  expect(await screen.findByLabelText('Class code K7PQ2MXA')).toBeOnTheScreen()
  await fireEvent.press(screen.getByLabelText('Share join link'))
  expect(share.mock.calls[0]![0]).toEqual({ message: expect.stringContaining('/classes/join/K7PQ2MXA') })

  await fireEvent.changeText(screen.getByLabelText('Write an announcement'), 'Test on Friday')
  await fireEvent.press(screen.getByText('Post'))
  expect(await screen.findByText('Test on Friday')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'CreateClassroomPost')?.variables).toEqual({ classroomId: CLASS, body: doc('Test on Friday') })

  await fireEvent.press(screen.getByText('People'))
  await fireEvent.changeText(await screen.findByLabelText('Handle or email'), 'priya')
  await fireEvent.press(screen.getByText('Invite as TA'))
  expect(await screen.findByText('Invite sent. It lasts 14 days.')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'InviteToClassroom')?.variables).toEqual({ classroomId: CLASS, person: 'priya', role: 'TA' })

  await fireEvent.press(screen.getByText('Requests'))
  expect(await screen.findByText('Kiran Das')).toBeOnTheScreen()
  await fireEvent.press(screen.getByText('Let in'))
  await waitFor(() => expect(api.calls.find((c) => c.op === 'ReviewClassroomJoinRequest')?.variables).toEqual({ requestId: 'jr1', decision: 'APPROVED' }))
  expect(await screen.findByText('No requests waiting.')).toBeOnTheScreen()
})
