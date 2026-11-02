import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import * as ReactNative from 'react-native'
import { copy } from '@/features/auth/copy'
import { VerifyEmailBanner } from '@/features/auth/VerifyEmailBanner'
import { createApolloClient } from '@/lib/apollo'
import { mockApi, ok, viewer } from '../../support/api'
import { renderInApp } from '../../support/render'

const inApp = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)

beforeEach(() => {
  jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 412, height: 915, scale: 2, fontScale: 1 })
})

afterEach(() => {
  jest.restoreAllMocks()
})

it('stays hidden once the sign-in email is confirmed', async () => {
  const api = mockApi({ Viewer: () => ({ data: { viewer: viewer({ emailVerified: true }) } }) })
  await inApp(<VerifyEmailBanner />)
  await waitFor(() => expect(api.ops()).toContain('Viewer'))
  expect(screen.queryByText(copy.verifyEmail.lead)).toBeNull()
})

it('resends the link, then drops the banner once the account is confirmed', async () => {
  let confirmed = false
  const api = mockApi({
    Viewer: () => ({ data: { viewer: viewer({ emailVerified: confirmed }) } }),
    ResendVerification: () => ({ data: { resendVerification: ok } }),
  })
  await inApp(<VerifyEmailBanner />)
  expect(await screen.findByText(copy.verifyEmail.lead)).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: copy.verifyEmail.resend })).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: copy.verifyEmail.check })).toBeOnTheScreen()

  await fireEvent.press(screen.getByRole('button', { name: copy.verifyEmail.resend }))
  expect(await screen.findByText(copy.verifyEmail.sent)).toBeOnTheScreen()
  expect(api.ops()).toContain('ResendVerification')

  confirmed = true
  await fireEvent.press(screen.getByRole('button', { name: copy.verifyEmail.check }))
  await waitFor(() => expect(screen.queryByText(copy.verifyEmail.lead)).toBeNull())
})

it('says the email is still unconfirmed, and names the wait when resend is rate limited', async () => {
  mockApi({
    Viewer: () => ({ data: { viewer: viewer({ emailVerified: false }) } }),
    ResendVerification: () => ({ data: { resendVerification: { __typename: 'OkPayload', ok: false, userErrors: [{ __typename: 'UserError', field: null, message: 'Too many links.', code: 'RATE_LIMITED', retryAfter: 120 }] } } }),
  })
  await inApp(<VerifyEmailBanner />)
  await fireEvent.press(await screen.findByRole('button', { name: copy.verifyEmail.check }))
  expect(await screen.findByText(copy.verifyEmail.still)).toBeOnTheScreen()

  await fireEvent.press(screen.getByRole('button', { name: copy.verifyEmail.resend }))
  expect(await screen.findByText('Too many links. You can try again in 2 minutes.')).toBeOnTheScreen()
})

it('never asks a platform admin to verify when viewerNeedsVerification is absent', async () => {
  const api = mockApi({ Viewer: () => ({ data: { viewer: viewer({ globalRole: 'PLATFORM_ADMIN', emailVerified: false, verified: false, viewerNeedsVerification: null }) } }) })
  await inApp(<VerifyEmailBanner />)
  await waitFor(() => expect(api.ops()).toContain('Viewer'))
  expect(screen.queryByText(copy.verifyEmail.lead)).toBeNull()
})

it('hides the banner when viewerNeedsVerification is false, and shows it when that field is true', async () => {
  const hidden = mockApi({ Viewer: () => ({ data: { viewer: viewer({ globalRole: 'STUDENT', emailVerified: false, viewerNeedsVerification: false }) } }) })
  await inApp(<VerifyEmailBanner />)
  await waitFor(() => expect(hidden.ops()).toContain('Viewer'))
  expect(screen.queryByText(copy.verifyEmail.lead)).toBeNull()

  mockApi({ Viewer: () => ({ data: { viewer: viewer({ globalRole: 'PLATFORM_ADMIN', emailVerified: false, viewerNeedsVerification: true }) } }) })
  await inApp(<VerifyEmailBanner />)
  expect(await screen.findByText(copy.verifyEmail.lead)).toBeOnTheScreen()
})
