import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { TeachScreen } from '@/features/verification/TeachScreen'
import { createApolloClient } from '@/lib/apollo'
import { mockApi, viewer } from '../../support/api'
import { renderInApp } from '../../support/render'

/** Becoming a teacher on the phone (lvn-backend ADR-0073): apply, then set up classes while the review waits. */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }))

const me = { __typename: 'User', id: 'u1', displayName: 'Asha Rao', handle: 'asharao' }
const application = (over: Record<string, unknown> = {}) => ({ __typename: 'VerificationRequest', id: 'a1', purpose: 'TEACHER_ROLE', institution: 'Govt. Junior College', subjects: 'Physics', method: 'DOCUMENTS', status: 'PENDING', message: null, reason: null, createdAt: new Date().toISOString(), decidedAt: null, requester: me, teacher: null, ...over })

it('applies to teach and then says classes can be set up while the review waits', async () => {
  let status = 'NONE'
  let mine: unknown = null
  const api = mockApi({
    Viewer: () => ({ data: { viewer: viewer({ teacherStatus: status }) } }),
    MyTeacherApplication: () => ({ data: { myTeacherApplication: mine } }),
    ApplyToTeach: () => {
      status = 'PENDING'
      mine = application()
      return { data: { applyToTeach: { request: mine, userErrors: [] } } }
    },
  })
  await renderInApp(<ApolloProvider client={createApolloClient()}><TeachScreen /></ApolloProvider>)
  await fireEvent.changeText(await screen.findByLabelText('Where you teach'), 'Govt. Junior College')
  await fireEvent.changeText(screen.getByLabelText('What you teach (optional)'), 'Physics')
  await fireEvent.press(screen.getByRole('button', { name: 'Apply to teach' }))
  await waitFor(() => expect(api.calls.find((c) => c.op === 'ApplyToTeach')?.variables).toEqual({ input: { institution: 'Govt. Junior College', subjects: 'Physics', message: null, fileIds: [] } }))
  expect(await screen.findByText('Your application is being reviewed')).toBeOnTheScreen()
})

it('tells a declined applicant why, and lets them apply again', async () => {
  mockApi({
    Viewer: () => ({ data: { viewer: viewer({ teacherStatus: 'DECLINED' }) } }),
    MyTeacherApplication: () => ({ data: { myTeacherApplication: application({ status: 'REJECTED', reason: 'We could not find you on the staff page.' }) } }),
  })
  await renderInApp(<ApolloProvider client={createApolloClient()}><TeachScreen /></ApolloProvider>)
  expect(await screen.findByText('We could not find you on the staff page. You can apply again.')).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Apply to teach' })).toBeOnTheScreen()
})
