import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library'
import { signedIn, signedOut } from '@/lib/auth/session'
import { mockApi, ok, session, signInOptions, viewer } from '../../support/api'
import { items } from '../../support/secure-store'

/**
 * Accounts from age 13 (AGE_MIN; lvn-backend ADR-0091; the floor moved from 8, and before that from 18), asked as an
 * age in whole years (ADR-0104): every age confirmed in words, only `age` sent, ages 13 to 17 join with no parent or
 * guardian step, a refusal under that floor remembered on the device for a day, and nothing deleted or signed out
 * because of a refusal that was already there.
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
// The API's answer since 2026-10-25; UNDER_MINIMUM_AGE is what an older API sent.
const refusal = (op: 'signUp' | 'completeRegistration', code: 'AGE_RESTRICTED' | 'UNDER_MINIMUM_AGE' = 'AGE_RESTRICTED') => ({
  __typename: 'UserError',
  field: ['input', 'age'],
  message: 'Sorry, you can’t create an account. Contact an admin at admin@example.com.',
  code,
  supportEmail: 'admin@example.com',
  op,
})
const typeAge = async (age: string) => fireEvent.changeText(screen.getByLabelText('Your age'), age)
const fillSignUp = async () => {
  await fireEvent.changeText(screen.getByLabelText('Your name'), 'Asha Rao')
  await fireEvent.changeText(screen.getByLabelText('Email'), 'asha@example.com')
  await fireEvent.changeText(screen.getByLabelText('Password'), 'a long enough passphrase')
  await typeAge('22')
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

it('asks for the age as one number, says it back in words and asks before sending it, whatever it is', async () => {
  const api = mockApi({ SignInOptions: () => signInOptions })
  await render('./app', { initialUrl: '/sign-up' })
  await fillSignUp()
  // One number field with the number pad, and no date of birth anywhere.
  expect(screen.getByLabelText('Your age').props.keyboardType).toBe('number-pad')
  expect(screen.queryByText(/date of birth/i)).toBeNull()
  await press(screen.getByText('Create account'))
  expect(screen.getByText('Is this right?')).toBeVisible()
  expect(screen.getByText('22 years old')).toBeVisible()
  await press(screen.getByText('Change it'))
  expect(screen.queryByText('Is this right?')).toBeNull()
  expect(api.ops()).not.toContain('SignUp')
  // The form names 13, and does not still say 8 or 18.
  expect(screen.getByText(/at least 13/)).toBeVisible()
  expect(screen.queryByText(/at least 8/)).toBeNull()
  expect(screen.queryByText(/18/)).toBeNull()
  expect(screen.queryByText(/parent|guardian|only for adults/i)).toBeNull()
})

it('checks the age on the phone: a whole number from 13 to 120', async () => {
  const api = mockApi({ SignInOptions: () => signInOptions })
  await render('./app', { initialUrl: '/sign-up' })
  await fillSignUp()
  await typeAge('')
  await press(screen.getByText('Create account'))
  expect(screen.getByText('Enter your age.')).toBeVisible()
  await typeAge('17.5')
  await settle()
  expect(screen.getByText('Enter your age as a whole number.')).toBeVisible()
  await typeAge('0')
  await settle()
  expect(screen.getByText('Enter an age from 13 to 120.')).toBeVisible()
  await typeAge('8')
  await settle()
  expect(screen.getByText('Enter an age from 13 to 120.')).toBeVisible()
  await typeAge('12')
  await press(screen.getByText('Create account'))
  expect(screen.getByText('Enter an age from 13 to 120.')).toBeVisible()
  expect(screen.queryByText('Is this right?')).toBeNull()
  await typeAge('121')
  await press(screen.getByText('Create account'))
  expect(screen.getByText('Enter an age from 13 to 120.')).toBeVisible()
  expect(screen.queryByText('Is this right?')).toBeNull()
  expect(api.ops()).not.toContain('SignUp')
})

it('puts the API’s refusal of an age on the age field', async () => {
  mockApi({
    SignInOptions: () => signInOptions,
    SignUp: () => ({ data: { signUp: { __typename: 'AuthPayload', session: null, userErrors: [{ __typename: 'UserError', field: ['input', 'age'], message: 'Enter an age from 1 to 120.', code: 'VALIDATION' }] } } }),
  })
  await render('./app', { initialUrl: '/sign-up' })
  await fillSignUp()
  await press(screen.getByText('Create account'))
  await press(screen.getByText('Yes, that’s right'))
  expect(screen.getByText('Enter an age from 1 to 120.')).toBeVisible()
  // A typo to correct, not a refusal: the form stays open.
  expect(screen.getByLabelText('Your age')).toHaveDisplayValue('22')
  expect(items.has('lvn.ageRefused')).toBe(false)
})

it.each(['AGE_RESTRICTED', 'UNDER_MINIMUM_AGE'] as const)('a refusal (%s) closes sign-up on this device for a day, and sends only the age', async (code) => {
  const api = mockApi({ SignInOptions: () => signInOptions, SignUp: () => ({ data: { signUp: { __typename: 'AuthPayload', session: null, userErrors: [refusal('signUp', code)] } } }) })
  await render('./app', { initialUrl: '/sign-up' })
  await fillSignUp()
  await typeAge('16')
  await press(screen.getByText('Create account'))
  expect(screen.getByText('16 years old')).toBeVisible()
  await press(screen.getByText('Yes, that’s right'))
  expect(screen.getByText('Sorry, you can’t create an account')).toBeVisible()
  expect(screen.getByText('LearnViaNotes accounts are for ages 13 and up. If you already have an account, you can still sign in.')).toBeVisible()
  expect(screen.queryByText(/only for adults|parent|guardian/i)).toBeNull()
  expect(screen.queryByLabelText('Your age')).toBeNull()
  expect(Number(items.get('lvn.ageRefused'))).toBeGreaterThan(0)
  expect(api.ops().filter((op) => op !== 'SignInOptions')).toEqual(['SignUp'])
  const input = api.calls.find((c) => c.op === 'SignUp')!.variables.input as Record<string, unknown>
  expect(input.age).toBe(16)
  expect(input).not.toHaveProperty('dateOfBirth')
})

it('the refusal is gone after a day', async () => {
  items.set('lvn.ageRefused', String(Date.now() - 86_400_001))
  mockApi({ SignInOptions: () => signInOptions })
  await render('./app', { initialUrl: '/sign-up' })
  expect(screen.getByLabelText('Your age')).toBeVisible()
  expect(items.has('lvn.ageRefused')).toBe(false)
})

it.each(['13', '17'])('age %s is sent and joins, with no parent or guardian step', async (age) => {
  const created = viewer({ restrictedMinor: true })
  const api = mockApi({
    SignInOptions: () => signInOptions,
    SignUp: () => ({ data: { signUp: { __typename: 'AuthPayload', session: session(created), userErrors: [] } } }),
    Viewer: () => ({ data: { viewer: created } }),
  })
  await render('./app', { initialUrl: '/sign-up' })
  await fillSignUp()
  await typeAge(age)
  await press(screen.getByText('Create account'))
  expect(screen.getByText(`${Number(age)} years old`)).toBeVisible()
  await press(screen.getByText('Yes, that’s right'))
  await settle()
  const input = api.calls.find((c) => c.op === 'SignUp')!.variables.input as Record<string, unknown>
  expect(input.age).toBe(Number(age))
  expect(input).not.toHaveProperty('dateOfBirth')
  expect(items.has('lvn.ageRefused')).toBe(false)
  expect(screen.queryByText(/parent|guardian|only for adults/i)).toBeNull()
  expect(screen.queryByText('Sorry, you can’t create an account')).toBeNull()
})

it('an age the API refuses on a new provider account signs out, and the welcome screen says why', async () => {
  const api = mockApi({
    SignInOptions: () => signInOptions,
    Viewer: () => ({ data: { viewer: viewer({ registrationComplete: false }) } }),
    CompleteRegistration: () => ({ data: { completeRegistration: { __typename: 'OkPayload', ok: false, userErrors: [refusal('completeRegistration')] } } }),
    SignOut: () => ({ data: { signOut: ok } }),
  })
  await act(() => signedIn(session(viewer({ registrationComplete: false }))))
  await render('./app', { initialUrl: '/' })
  await typeAge('15')
  await press(screen.getByRole('checkbox'))
  await press(screen.getByText('Continue'))
  expect(screen.getByText('15 years old')).toBeVisible()
  await press(screen.getByText('Yes, that’s right'))
  await settle()
  const input = api.calls.find((c) => c.op === 'CompleteRegistration')!.variables.input as Record<string, unknown>
  expect(input.age).toBe(15)
  expect(input).not.toHaveProperty('dateOfBirth')
  expect(api.ops()).toContain('SignOut')
  expect(screen.getByText(/Sorry, you can’t create an account/)).toBeVisible()
  expect(screen.getByText(/accounts are for ages 13 and up/)).toBeVisible()
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
  expect(screen.queryByLabelText('Your age')).toBeNull()
  expect(api.ops()).not.toContain('CompleteRegistration')
  expect(api.ops()).not.toContain('RequestAccountDeletion')
  await press(screen.getByTestId('details-sign-out'))
  expect(api.ops()).toContain('SignOut')
})
