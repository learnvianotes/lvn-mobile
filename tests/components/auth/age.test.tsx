import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library'
import { signedIn, signedOut } from '@/lib/auth/session'
import { mockApi, ok, session, signInOptions, viewer } from '../../support/api'
import { items } from '../../support/secure-store'

/**
 * Accounts for adults only (lvn-backend ADR-0091): every date of birth confirmed in words, a refusal remembered on the
 * device for a day, and nothing deleted or signed out because of a refusal that was already there.
 */
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
const refusal = (op: 'signUp' | 'completeRegistration') => ({
  __typename: 'UserError',
  field: ['input', 'dateOfBirth'],
  message: 'Sorry, you can’t create an account.',
  code: 'UNDER_MINIMUM_AGE',
  op,
})
const typeDob = async (day: string, month: string, year: string) => {
  await fireEvent.changeText(screen.getByLabelText('Date of birth, Day'), day)
  await fireEvent.changeText(screen.getByLabelText('Date of birth, Month'), month)
  await fireEvent.changeText(screen.getByLabelText('Date of birth, Year'), year)
}
const fillSignUp = async () => {
  await fireEvent.changeText(screen.getByLabelText('Your name'), 'Asha Rao')
  await fireEvent.changeText(screen.getByLabelText('Email'), 'asha@example.com')
  await fireEvent.changeText(screen.getByLabelText('Password'), 'a long enough passphrase')
  await typeDob('1', '5', '2004')
  await press(screen.getByRole('checkbox'))
}

beforeEach(async () => {
  items.delete('lvn.ageRefused')
  await act(() => signedOut())
})
afterEach(async () => {
  await act(() => signedOut())
  jest.useRealTimers()
})

it('shows the date of birth in words and asks before sending it, whatever it is', async () => {
  const api = mockApi({ SignInOptions: () => signInOptions })
  await render('./app', { initialUrl: '/sign-up' })
  await fillSignUp()
  expect(screen.getByText(/^1 May 2004 · /)).toBeVisible()
  await press(screen.getByText('Create account'))
  expect(screen.getByText('Is this right?')).toBeVisible()
  await press(screen.getByText('Change it'))
  expect(screen.queryByText('Is this right?')).toBeNull()
  expect(api.ops()).not.toContain('SignUp')
  // Nothing on the form names the cut-off.
  expect(screen.queryByText(/18/)).toBeNull()
})

it('a refusal closes sign-up on this device for a day, and creates nothing', async () => {
  const api = mockApi({ SignInOptions: () => signInOptions, SignUp: () => ({ data: { signUp: { __typename: 'AuthPayload', session: null, userErrors: [refusal('signUp')] } } }) })
  await render('./app', { initialUrl: '/sign-up' })
  await fillSignUp()
  await typeDob('1', '5', '2012')
  await press(screen.getByText('Create account'))
  expect(screen.getByText('1 May 2012')).toBeVisible()
  await press(screen.getByText('Yes, that’s right'))
  expect(screen.getByText('Sorry, you can’t create an account')).toBeVisible()
  expect(screen.queryByLabelText('Date of birth, Day')).toBeNull()
  expect(Number(items.get('lvn.ageRefused'))).toBeGreaterThan(0)
  expect(api.ops().filter((op) => op !== 'SignInOptions')).toEqual(['SignUp'])
})

it('the refusal is gone after a day', async () => {
  items.set('lvn.ageRefused', String(Date.now() - 86_400_001))
  mockApi({ SignInOptions: () => signInOptions })
  await render('./app', { initialUrl: '/sign-up' })
  expect(screen.getByLabelText('Date of birth, Day')).toBeVisible()
  expect(items.has('lvn.ageRefused')).toBe(false)
})

it('an under-age answer on a new provider account signs out, and the welcome screen says why', async () => {
  const api = mockApi({
    SignInOptions: () => signInOptions,
    Viewer: () => ({ data: { viewer: viewer({ registrationComplete: false }) } }),
    CompleteRegistration: () => ({ data: { completeRegistration: { __typename: 'OkPayload', ok: false, userErrors: [refusal('completeRegistration')] } } }),
    SignOut: () => ({ data: { signOut: ok } }),
  })
  await act(() => signedIn(session(viewer({ registrationComplete: false }))))
  await render('./app', { initialUrl: '/' })
  await typeDob('3', '2', '2011')
  await press(screen.getByRole('checkbox'))
  await press(screen.getByText('Continue'))
  await press(screen.getByText('Yes, that’s right'))
  await settle()
  expect(api.ops()).toContain('SignOut')
  expect(screen.getByText(/Sorry, you can’t create an account/)).toBeVisible()
  // Email sign-up is closed on this device; signing in to an existing account still works.
  expect(screen.queryByTestId('welcome-email')).toBeNull()
  expect(screen.getByTestId('welcome-sign-in')).toBeVisible()
})

it('a refusal already on the device only closes the details form: the account is left alone', async () => {
  items.set('lvn.ageRefused', String(Date.now()))
  const api = mockApi({ SignInOptions: () => signInOptions, Viewer: () => ({ data: { viewer: viewer({ registrationComplete: false }) } }), SignOut: () => ({ data: { signOut: ok } }) })
  await act(() => signedIn(session(viewer({ registrationComplete: false }))))
  await render('./app', { initialUrl: '/' })
  expect(screen.getByText('Sorry, you can’t create an account')).toBeVisible()
  expect(screen.queryByLabelText('Date of birth, Day')).toBeNull()
  expect(api.ops()).not.toContain('CompleteRegistration')
  expect(api.ops()).not.toContain('RequestAccountDeletion')
  await press(screen.getByTestId('details-sign-out'))
  expect(api.ops()).toContain('SignOut')
})
