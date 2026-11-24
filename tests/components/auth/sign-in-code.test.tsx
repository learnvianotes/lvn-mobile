import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library'
import { signedOut } from '@/lib/auth/session'
import { mockApi, session, signInOptions, viewer } from '../../support/api'

/** Sign in with an emailed code (lvn-backend ADR-0115); GitHub and LinkedIn sign-in are retired. */

jest.setTimeout(15_000)
const settle = () => act(async () => void (await jest.advanceTimersByTimeAsync(500)))
const press = async (el: Parameters<typeof fireEvent.press>[0]) => {
  await fireEvent.press(el)
  await settle()
}
const render = async (...args: Parameters<typeof renderRouter>) => {
  await renderRouter(...args)
  await settle()
}

afterEach(async () => {
  await act(() => signedOut())
  jest.useRealTimers()
})

it('emails a code, then signs in with it', async () => {
  const asked: string[] = []
  const tried: { email: string; code: string }[] = []
  mockApi({
    SignInOptions: () => signInOptions,
    RequestSignInCode: (v) => (asked.push(String(v.email)), { data: { requestSignInCode: { __typename: 'OkPayload', ok: true, userErrors: [] } } }),
    SignInWithCode: (v) => (tried.push({ email: String(v.email), code: String(v.code) }), { data: { signInWithCode: { __typename: 'AuthPayload', session: session(), userErrors: [] } } }),
    Viewer: () => viewer(),
  })
  await render('./app', { initialUrl: '/sign-in' })
  await fireEvent.changeText(screen.getByTestId('sign-in-email'), 'asha@example.com ')
  await press(screen.getByTestId('sign-in-submit'))
  expect(asked).toEqual(['asha@example.com'])
  expect(screen.getByText('Check your email')).toBeTruthy()
  await fireEvent.changeText(screen.getByTestId('sign-in-code'), '123456')
  await press(screen.getByTestId('sign-in-code-submit'))
  expect(tried).toEqual([{ email: 'asha@example.com', code: '123456' }])
})

it('keeps the password one tap away', async () => {
  mockApi({ SignInOptions: () => signInOptions })
  await render('./app', { initialUrl: '/sign-in' })
  expect(screen.queryByTestId('sign-in-password')).toBeNull()
  await press(screen.getByTestId('sign-in-mode'))
  expect(screen.getByTestId('sign-in-password')).toBeTruthy()
})

it('has no GitHub or LinkedIn button, even if an old API offered one', async () => {
  mockApi({ SignInOptions: () => ({ data: { ...signInOptions.data, signInOptions: { ...signInOptions.data.signInOptions, github: true, linkedin: true } } }) })
  await render('./app', { initialUrl: '/sign-in' })
  expect(screen.queryByText('Continue with GitHub')).toBeNull()
  expect(screen.queryByText('Continue with LinkedIn')).toBeNull()
})
