import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library'
import { copy } from '@/features/auth/copy'
import { signedIn, signedOut } from '@/lib/auth/session'
import { mockApi, ok, problem, session, signInOptions, viewer } from '../../support/api'

/**
 * The real app directory under expo-router's test renderer: which screens a session may see (app/_layout.tsx) and
 * the sign-in flows end to end against a fake API.
 */
jest.setTimeout(15_000)

/**
 * renderRouter runs on Jest's fake timers. Let requests answer, React re-render and navigation finish: RNTL's
 * findBy* only advances the clock synchronously, which never resolves a fetch.
 */
const settle = () => act(async () => void (await jest.advanceTimersByTimeAsync(500)))
const press = async (el: Parameters<typeof fireEvent.press>[0]) => {
  await fireEvent.press(el)
  await settle()
}

afterEach(async () => {
  await act(() => signedOut())
  jest.useRealTimers()
})

const render = async (...args: Parameters<typeof renderRouter>) => {
  await renderRouter(...args)
  await settle()
}
const signIn = async (user = viewer()) => act(() => signedIn(session(user)))
const signOutNow = async () => act(() => signedOut())

describe('signed out', () => {
  beforeEach(signOutNow)

  it('opens on the welcome screen, whatever link the app was opened with', async () => {
    mockApi({})
    await render('./app', { initialUrl: '/explore' })
    expect(screen.getByRole('header', { name: /Your Learning Community for a Brighter Tomorrow/ })).toBeVisible()
    // Without Google in this build, email sign-up is the first action.
    expect(screen.queryByTestId('welcome-google')).toBeNull()
    expect(screen.getByText('Get Started Free')).toBeVisible()
    expect(screen.queryByText('Explore')).toBeNull()
  })

  it('signs in and lands on Home', async () => {
    const api = mockApi({ SignInOptions: () => signInOptions, SignIn: () => ({ data: { signIn: { __typename: 'AuthPayload', session: session(), userErrors: [] } } }) })
    await render('./app', { initialUrl: '/' })
    await press(screen.getByTestId('welcome-sign-in'))
    await fireEvent.changeText(screen.getByLabelText('Email'), ' asha@example.com ')
    await fireEvent.changeText(screen.getByLabelText('Password'), 'a long enough passphrase')
    await press(screen.getByRole('button', { name: 'Sign in' }))
    await settle()
    expect(screen.getByLabelText('Search notes, topics, people, or ask AI…')).toBeVisible()
    expect(api.calls.find((c) => c.op === 'SignIn')!.variables).toEqual({ input: { email: 'asha@example.com', password: 'a long enough passphrase' } })
  })

  it('checks the sign-in form before sending anything, then shows the API’s message', async () => {
    const api = mockApi({
      SignInOptions: () => signInOptions,
      SignIn: () => ({ data: { signIn: { __typename: 'AuthPayload', session: null, userErrors: [{ __typename: 'UserError', field: null, message: 'Email or password is incorrect.', code: 'VALIDATION' }] } } }),
    })
    await render('./app', { initialUrl: '/sign-in' })
    await press(screen.getByRole('button', { name: 'Sign in' }))
    expect(screen.getByText('Enter a valid email address.')).toBeVisible()
    expect(api.ops()).not.toContain('SignIn')
    await fireEvent.changeText(screen.getByLabelText('Email'), 'asha@example.com')
    await fireEvent.changeText(screen.getByLabelText('Password'), 'wrong password')
    await press(screen.getByRole('button', { name: 'Sign in' }))
    expect(screen.getByText('Email or password is incorrect.')).toBeVisible()
    expect(screen.getByLabelText('Email')).toHaveDisplayValue('asha@example.com')
    expect(screen.getByLabelText('Password')).toHaveDisplayValue('')
  })

  it('creates an account with a college email and continues to its code', async () => {
    const created = viewer({ institutionalEmail: 'asha@iitb.ac.in', institutionalEmailStatus: 'CODE_SENT' })
    const api = mockApi({
      SignInOptions: () => signInOptions,
      SignUp: () => ({ data: { signUp: { __typename: 'AuthPayload', session: session(created), userErrors: [] } } }),
      Viewer: () => ({ data: { viewer: created } }),
      VerifyInstitutionalEmail: (v) => ({ data: { verifyInstitutionalEmail: v.code === '123456' ? ok : { __typename: 'OkPayload', ok: false, userErrors: [{ __typename: 'UserError', field: ['input', 'code'], message: 'That code is not right. 4 tries left.', code: 'VALIDATION' }] } } }),
    })
    await render('./app', { initialUrl: '/sign-up' })
    await fireEvent.changeText(screen.getByLabelText('Your name'), 'Asha Rao')
    await fireEvent.changeText(screen.getByLabelText('Email'), 'asha@example.com')
    await fireEvent.changeText(screen.getByLabelText('Password'), 'a long enough passphrase')
    await fireEvent.changeText(screen.getByLabelText('Date of birth, Day'), '1')
    await fireEvent.changeText(screen.getByLabelText('Date of birth, Month'), '5')
    await fireEvent.changeText(screen.getByLabelText('Date of birth, Year'), '2004')
    await fireEvent.changeText(screen.getByLabelText('College or organisation email (optional)'), 'asha@iitb.ac.in')
    await press(screen.getByRole('checkbox'))
    await settle()
    expect(screen.getByText('Create account')).toBeEnabled()
    await press(screen.getByText('Create account'))
    // Every date of birth is confirmed in words before it is sent (lvn-backend ADR-0091).
    expect(screen.getByText('1 May 2004')).toBeVisible()
    await press(screen.getByText('Yes, that’s right'))
    expect(screen.getByText('We sent a 6-digit code to asha@iitb.ac.in.')).toBeVisible()
    expect(api.calls.find((c) => c.op === 'SignUp')!.variables.input).toEqual({
      displayName: 'Asha Rao',
      email: 'asha@example.com',
      password: 'a long enough passphrase',
      dateOfBirth: '2004-05-01',
      institutionalEmail: 'asha@iitb.ac.in',
      acceptedTermsVersion: '2026-10-08',
    })
    await fireEvent.changeText(screen.getByLabelText('Code'), '000000')
    await press(screen.getByText('Verify'))
    expect(screen.getByText('That code is not right. 4 tries left.')).toBeVisible()
    expect(screen.getByLabelText('Code')).toHaveDisplayValue('')
  })

  it('refuses an impossible date of birth and a missing terms acceptance', async () => {
    const api = mockApi({ SignInOptions: () => signInOptions })
    await render('./app', { initialUrl: '/sign-up' })
    await fireEvent.changeText(screen.getByLabelText('Date of birth, Day'), '30')
    await fireEvent.changeText(screen.getByLabelText('Date of birth, Month'), '2')
    await fireEvent.changeText(screen.getByLabelText('Date of birth, Year'), '2004')
    await settle()
    expect(screen.getByText('Create account')).toBeEnabled()
    await press(screen.getByText('Create account'))
    expect(screen.getByText('Enter a real date, for example 1 5 2004.')).toBeVisible()
    expect(screen.getByText('Accept the terms to continue.')).toBeVisible()
    expect(api.ops()).not.toContain('SignUp')
  })

  it('says so when the API cannot be reached, instead of a button that does nothing', async () => {
    const api = mockApi({}) // every operation fails, SignInOptions included
    await render('./app', { initialUrl: '/sign-up' })
    expect(screen.getByText('Create account')).toBeEnabled()
    await fireEvent.changeText(screen.getByLabelText('Your name'), 'Asha Rao')
    await fireEvent.changeText(screen.getByLabelText('Email'), 'asha@example.com')
    await fireEvent.changeText(screen.getByLabelText('Password'), 'a long enough passphrase')
    await fireEvent.changeText(screen.getByLabelText('Date of birth, Day'), '1')
    await fireEvent.changeText(screen.getByLabelText('Date of birth, Month'), '5')
    await fireEvent.changeText(screen.getByLabelText('Date of birth, Year'), '2004')
    await press(screen.getByRole('checkbox'))
    await press(screen.getByText('Create account'))
    await press(screen.getByText('Yes, that’s right'))
    expect(screen.getByText('Something went wrong. Check your connection and try again.')).toBeVisible()
    expect(api.ops().filter((op) => op === 'SignInOptions').length).toBeGreaterThan(1) // tried again
    expect(api.ops()).not.toContain('SignUp')
  })

  it('sends a reset link', async () => {
    const api = mockApi({ RequestPasswordReset: () => ({ data: { requestPasswordReset: ok } }) })
    await render('./app', { initialUrl: '/reset' })
    await fireEvent.changeText(screen.getByLabelText('Email'), 'asha@example.com')
    await press(screen.getByText('Send link'))
    expect(screen.getByText(/If an account uses that email/)).toBeVisible()
    expect(api.calls.at(-1)!.variables).toEqual({ email: 'asha@example.com' })
  })

  it('says the same thing when the reset is refused for an unknown email', async () => {
    mockApi({
      RequestPasswordReset: () => ({ data: { requestPasswordReset: { __typename: 'OkPayload', ok: false, userErrors: [problem(['input', 'email'], 'No account uses that email.', 'NOT_FOUND')] } } }),
    })
    await render('./app', { initialUrl: '/reset' })
    await fireEvent.changeText(screen.getByLabelText('Email'), 'nobody@example.com')
    await press(screen.getByText('Send link'))
    expect(screen.getByText(/If an account uses that email/)).toBeVisible()
    expect(screen.queryByText('No account uses that email.')).toBeNull()
  })

  it('rewrites an invite-only sign-in and clears it when the email changes', async () => {
    mockApi({
      SignInOptions: () => signInOptions,
      SignIn: () => ({ data: { signIn: { __typename: 'AuthPayload', session: null, userErrors: [problem(null, 'Registration is invite-only.', 'FORBIDDEN')] } } }),
    })
    await render('./app', { initialUrl: '/sign-in' })
    await fireEvent.changeText(screen.getByLabelText('Email'), 'asha@example.com')
    await fireEvent.changeText(screen.getByLabelText('Password'), 'a long enough passphrase')
    await press(screen.getByRole('button', { name: 'Sign in' }))
    expect(screen.getByText(copy.errors.inviteOnly)).toBeVisible()
    expect(screen.queryByText('Registration is invite-only.')).toBeNull()
    await fireEvent.changeText(screen.getByLabelText('Email'), 'asha@example.com ')
    expect(screen.queryByText(copy.errors.inviteOnly)).toBeNull()
  })
})

describe('signed in', () => {
  it('asks a provider account for its details first, then lets it in', async () => {
    mockApi({
      SignInOptions: () => signInOptions,
      Viewer: () => ({ data: { viewer: viewer({ registrationComplete: false, displayName: 'Asha from GitHub' }) } }),
      CompleteRegistration: () => ({ data: { completeRegistration: ok } }),
    })
    await signIn(viewer({ registrationComplete: false }))
    await render('./app', { initialUrl: '/' })
    expect(screen.getByText('Almost there, Asha')).toBeVisible()
    await settle()
    expect(screen.getByLabelText('Your name')).toHaveDisplayValue('Asha from GitHub')
    await fireEvent.changeText(screen.getByLabelText('Date of birth, Day'), '1')
    await fireEvent.changeText(screen.getByLabelText('Date of birth, Month'), '5')
    await fireEvent.changeText(screen.getByLabelText('Date of birth, Year'), '2004')
    await press(screen.getByRole('checkbox'))
    await settle()
    expect(screen.getByText('Continue')).toBeEnabled()
    await press(screen.getByText('Continue'))
    await press(screen.getByText('Yes, that’s right'))
    await settle()
    expect(screen.getByLabelText('Search notes, topics, people, or ask AI…')).toBeVisible()
  })

  it('shows the account in Settings and signs out back to the welcome screen', async () => {
    const api = mockApi({
      Viewer: () => ({ data: { viewer: viewer({ verified: true, verificationMethod: 'TEACHER' }) } }),
      SignOut: () => ({ data: { signOut: ok } }),
    })
    await signIn()
    await render('./app', { initialUrl: '/profile' })
    expect(screen.getByText('Asha Rao')).toBeVisible()
    // The account is in Settings, behind the Profile tab's gear (ADR-0076).
    await press(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByText('by a teacher')).toBeVisible()
    await press(screen.getByText('Sign out'))
    expect(screen.getByText('Get Started Free')).toBeVisible()
    expect(api.calls.find((c) => c.op === 'SignOut')!.headers.get('authorization')).toMatch(/^Bearer /)
  })

  it('reloads the account after a college code, so verified does not stay as it was at sign-in', async () => {
    let confirmed = false
    const user = () => viewer({ institutionalEmail: 'asha@iitb.ac.in', institutionalEmailStatus: confirmed ? 'CONFIRMED' : 'CODE_SENT', verified: confirmed })
    mockApi({
      Viewer: () => ({ data: { viewer: user() } }),
      VerifyInstitutionalEmail: () => {
        confirmed = true
        return { data: { verifyInstitutionalEmail: ok } }
      },
    })
    await signIn(user())
    await render('./app', { initialUrl: '/verify' })
    await fireEvent.changeText(screen.getByLabelText('Code'), '123456')
    await press(screen.getByText('Verify'))
    await settle()
    expect(screen.getByText('You are verified.')).toBeVisible()
  })
})
