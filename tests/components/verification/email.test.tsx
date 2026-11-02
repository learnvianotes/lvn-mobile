import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { VerifyCodeScreen } from '@/features/auth/VerifyCodeScreen'
import { createApolloClient } from '@/lib/apollo'
import { mockApi, viewer } from '../../support/api'
import { renderInApp } from '../../support/render'

/** College or organisation email on the verify screen: add it, then the code; verified, needs review, and refused. */
const searchParams: { token?: string } = {}
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), canGoBack: jest.fn(() => true), back: jest.fn(), replace: jest.fn() },
  Link: ({ children }: { children: React.ReactNode }) => children,
  useLocalSearchParams: () => searchParams,
}))

const inApollo = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)
const ok = { __typename: 'OkPayload', ok: true, userErrors: [] }

beforeEach(() => {
  searchParams.token = undefined
  jest.clearAllMocks()
})

it('adds a college email, which leads into the code', async () => {
  let status = 'NONE'
  let email: string | null = null
  const api = mockApi({
    Viewer: () => ({ data: { viewer: viewer({ institutionalEmailStatus: status, institutionalEmail: email }) } }),
    SetInstitutionalEmail: () => ((status = 'CODE_SENT'), (email = 'ravi@college.edu'), { data: { setInstitutionalEmail: ok } }),
  })
  await inApollo(<VerifyCodeScreen />)
  expect(await screen.findByRole('header', { name: 'Add college/organisation email' })).toBeOnTheScreen()
  await fireEvent.changeText(screen.getByLabelText('Email'), ' ravi@college.edu ')
  await fireEvent.press(screen.getByRole('button', { name: 'Send the code' }))
  expect(await screen.findByText('We sent a 6-digit code to ravi@college.edu.')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'SetInstitutionalEmail')?.variables).toEqual({ email: 'ravi@college.edu' })
})

it('says you are verified, or that a new organisation needs review', async () => {
  mockApi({ Viewer: () => ({ data: { viewer: viewer({ institutionalEmailStatus: 'CONFIRMED', institutionalEmail: 'ravi@college.edu', verified: true }) } }) })
  await inApollo(<VerifyCodeScreen />)
  expect(await screen.findByText('You are verified.')).toBeOnTheScreen()

  mockApi({ Viewer: () => ({ data: { viewer: viewer({ institutionalEmailStatus: 'PENDING_REVIEW', institutionalEmail: 'ravi@new.ac.in' }) } }) })
  await inApollo(<VerifyCodeScreen />)
  expect(await screen.findByText(/Needs review/)).toBeOnTheScreen()
  expect(screen.getByText(/Your address is confirmed/)).toBeOnTheScreen()
})

it('shows a refused address and the form to try another', async () => {
  mockApi({
    Viewer: () => ({ data: { viewer: viewer({ institutionalEmailStatus: 'REFUSED', institutionalEmail: 'ravi@nope.test' }) } }),
    SetInstitutionalEmail: () => ({ data: { setInstitutionalEmail: { __typename: 'OkPayload', ok: false, userErrors: [{ __typename: 'UserError', field: ['input', 'email'], message: 'That college address was not accepted.', code: 'VALIDATION' }] } } }),
  })
  await inApollo(<VerifyCodeScreen />)
  expect(await screen.findByText('This college or organisation email was not accepted. Add a different address.')).toBeOnTheScreen()
  await fireEvent.changeText(screen.getByLabelText('Email'), 'ravi@other.edu')
  await fireEvent.press(screen.getByRole('button', { name: 'Send the code' }))
  expect(await screen.findByText('That college address was not accepted.')).toBeOnTheScreen()
  await waitFor(() => expect(screen.getByLabelText('Email')).toBeOnTheScreen())
})

it('accepts a sign-in verification link and reloads the account', async () => {
  searchParams.token = 'email-token'
  let confirmed = false
  const api = mockApi({
    VerifyEmail: () => {
      confirmed = true
      return { data: { verifyEmail: { __typename: 'VerifyEmailPayload', ok: true, user: viewer({ emailVerified: true, verified: true }), userErrors: [] } } }
    },
    Viewer: () => ({ data: { viewer: viewer({ emailVerified: confirmed, verified: confirmed }) } }),
  })
  await inApollo(<VerifyCodeScreen />)
  expect(await screen.findByText('Your email is confirmed.')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'VerifyEmail')?.variables).toEqual({ token: 'email-token' })
  expect(api.ops().filter((op) => op === 'Viewer').length).toBeGreaterThan(0)
})
