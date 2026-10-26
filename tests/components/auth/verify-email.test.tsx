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
  expect(screen.getByRole('button', { name: copy.verifyEmail.resend }).props.className).toEqual(expect.stringContaining('flex-1'))

  await fireEvent.press(screen.getByRole('button', { name: copy.verifyEmail.resend }))
  expect(await screen.findByText(copy.verifyEmail.sent)).toBeOnTheScreen()
  expect(api.ops()).toContain('ResendVerification')

  confirmed = true
  await fireEvent.press(screen.getByRole('button', { name: copy.verifyEmail.check }))
  await waitFor(() => expect(screen.queryByText(copy.verifyEmail.lead)).toBeNull())
})

it('says the email is still unconfirmed, and stacks the actions on a narrow phone', async () => {
  jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 320, height: 640, scale: 2, fontScale: 1 })
  mockApi({
    Viewer: () => ({ data: { viewer: viewer({ emailVerified: false }) } }),
    ResendVerification: () => ({ data: { resendVerification: { __typename: 'OkPayload', ok: false, userErrors: [] } } }),
  })
  await inApp(<VerifyEmailBanner />)
  const resend = await screen.findByRole('button', { name: copy.verifyEmail.resend })
  expect(resend.props.className).toEqual(expect.stringContaining('w-full'))
  expect(screen.getByRole('button', { name: copy.verifyEmail.check }).props.className).toEqual(expect.stringContaining('w-full'))

  await fireEvent.press(screen.getByRole('button', { name: copy.verifyEmail.check }))
  expect(await screen.findByText(copy.verifyEmail.still)).toBeOnTheScreen()

  await fireEvent.press(screen.getByRole('button', { name: copy.verifyEmail.resend }))
  expect(await screen.findByText(copy.verifyEmail.failed)).toBeOnTheScreen()
})
