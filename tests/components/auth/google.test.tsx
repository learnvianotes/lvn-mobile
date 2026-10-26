import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library'
import { copy } from '@/features/auth/copy'
import { GOOGLE_SETUP_ERROR } from '@/lib/auth/google'
import { signedOut } from '@/lib/auth/session'
import { mockApi, session, signInOptions, viewer } from '../../support/api'

/**
 * Google sign-in (ADR-0007) without Google: native Google Sign-In and Firebase are replaced by stubs that answer as they
 * would. The API side (signInWithGoogle verifying the Firebase token) is covered by lvn-backend's e2e suite.
 */
jest.mock('@/lib/env', () => ({
  env: {
    EXPO_PUBLIC_APP_ENV: 'development',
    EXPO_PUBLIC_WEB_URL: 'http://web.test',
    EXPO_PUBLIC_API_URL: 'http://api.test/graphql',
    EXPO_PUBLIC_FIREBASE_API_KEY: 'firebase-key',
    EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'lvn-test.firebaseapp.com',
    EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'lvn-test',
    EXPO_PUBLIC_FIREBASE_APP_ID: '1:123:web:abc',
    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: '123-web.apps.googleusercontent.com',
  },
}))

const mockGoogle = { configure: jest.fn(), hasPlayServices: jest.fn(async () => true), signIn: jest.fn(), signOut: jest.fn(async () => null) }
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: mockGoogle,
  isCancelledResponse: (r: { type: string }) => r.type === 'cancelled',
}))

const mockFirebase = { signInWithCredential: jest.fn(), signOut: jest.fn(async (_auth: unknown) => undefined), credential: jest.fn((idToken: string) => ({ idToken })) }
jest.mock('firebase/app', () => ({ getApps: () => [], initializeApp: (config: unknown) => ({ config }) }))
jest.mock('firebase/auth', () => ({
  initializeAuth: (app: unknown) => ({ app }),
  inMemoryPersistence: 'memory',
  GoogleAuthProvider: { credential: (t: string) => mockFirebase.credential(t) },
  signInWithCredential: (auth: unknown, cred: unknown) => mockFirebase.signInWithCredential(auth, cred),
  signOut: (auth: unknown) => mockFirebase.signOut(auth),
}))

const settle = () => act(async () => void (await jest.advanceTimersByTimeAsync(500)))
const withGoogle = { data: { ...signInOptions.data, signInOptions: { ...signInOptions.data.signInOptions, google: true } } }

afterEach(async () => {
  await act(() => signedOut())
  jest.clearAllMocks()
  jest.useRealTimers()
})

it('signs in with Google through Firebase, sends the Firebase token, and signs both out again', async () => {
  mockGoogle.signIn.mockResolvedValue({ type: 'success', data: { idToken: 'google-id-token', user: { email: 'asha@gmail.com' } } })
  mockFirebase.signInWithCredential.mockResolvedValue({ user: { getIdToken: async () => 'firebase-id-token' } })
  const api = mockApi({
    SignInOptions: () => withGoogle,
    SignInWithGoogle: () => ({ data: { signInWithGoogle: { __typename: 'AuthPayload', session: session(viewer({ registrationComplete: false })), userErrors: [] } } }),
    Viewer: () => ({ data: { viewer: viewer({ registrationComplete: false }) } }),
  })
  await renderRouter('./app', { initialUrl: '/sign-in' })
  await settle()
  await fireEvent.press(screen.getByText('Continue with Google'))
  await settle()
  expect(mockGoogle.configure).toHaveBeenCalledWith({ webClientId: '123-web.apps.googleusercontent.com', scopes: ['openid', 'email', 'profile'] })
  expect(mockFirebase.credential).toHaveBeenCalledWith('google-id-token')
  expect(api.calls.find((c) => c.op === 'SignInWithGoogle')!.variables).toEqual({ idToken: 'firebase-id-token' })
  expect(mockFirebase.signOut).toHaveBeenCalled()
  expect(mockGoogle.signOut).toHaveBeenCalled()
  // A new Google account still owes its registration details (ADR-0017).
  expect(screen.getByText(/^Almost there/)).toBeVisible()
})

it('does nothing when the account chooser is closed, and shows the API’s refusal', async () => {
  const api = mockApi({
    SignInOptions: () => withGoogle,
    SignInWithGoogle: () => ({ data: { signInWithGoogle: { __typename: 'AuthPayload', session: null, userErrors: [{ __typename: 'UserError', field: null, message: 'This account was deleted.', code: 'FORBIDDEN' }] } } }),
  })
  await renderRouter('./app', { initialUrl: '/sign-in' })
  await settle()
  mockGoogle.signIn.mockResolvedValueOnce({ type: 'cancelled', data: null })
  await fireEvent.press(screen.getByText('Continue with Google'))
  await settle()
  expect(api.ops()).not.toContain('SignInWithGoogle')
  expect(mockFirebase.signInWithCredential).not.toHaveBeenCalled()

  mockGoogle.signIn.mockResolvedValueOnce({ type: 'success', data: { idToken: 'google-id-token' } })
  mockFirebase.signInWithCredential.mockResolvedValueOnce({ user: { getIdToken: async () => 'firebase-id-token' } })
  await fireEvent.press(screen.getByText('Continue with Google'))
  await settle()
  expect(screen.getByText('This account was deleted.')).toBeVisible()
  expect(screen.getByText('Welcome back. Pick up where you left off.')).toBeVisible()
})

it('says so when Google or Firebase fails, and still signs out of Google', async () => {
  mockApi({ SignInOptions: () => withGoogle })
  mockGoogle.signIn.mockResolvedValueOnce({ type: 'success', data: { idToken: 'google-id-token' } })
  mockFirebase.signInWithCredential.mockRejectedValueOnce(new Error(''))
  await renderRouter('./app', { initialUrl: '/sign-in' })
  await settle()
  await fireEvent.press(screen.getByText('Continue with Google'))
  await settle()
  expect(screen.getByText('That sign-in did not work. Try again.')).toBeVisible()
  expect(mockGoogle.signOut).toHaveBeenCalled()
})

it('puts Google first on the welcome screen: one tap, and a returning account is on Home', async () => {
  let choose!: (r: unknown) => void
  mockGoogle.signIn.mockReturnValueOnce(new Promise((resolve) => (choose = resolve)))
  mockFirebase.signInWithCredential.mockResolvedValue({ user: { getIdToken: async () => 'firebase-id-token' } })
  const api = mockApi({
    SignInOptions: () => withGoogle,
    SignInWithGoogle: () => ({ data: { signInWithGoogle: { __typename: 'AuthPayload', session: session(viewer()), userErrors: [] } } }),
    Viewer: () => ({ data: { viewer: viewer() } }),
  })
  await renderRouter('./app', { initialUrl: '/' })
  await settle()
  expect(screen.getByRole('header', { name: /Your Learning Community for a Brighter Tomorrow/ })).toBeVisible()
  await fireEvent.press(screen.getByTestId('welcome-google'))
  // While Google's account chooser is open the button says so and cannot be pressed twice.
  expect(screen.getByText('Signing in…')).toBeVisible()
  expect(screen.getByTestId('welcome-google')).toBeDisabled()
  await act(async () => choose({ type: 'success', data: { idToken: 'google-id-token' } }))
  await settle()
  expect(api.calls.find((c) => c.op === 'SignInWithGoogle')!.variables).toEqual({ idToken: 'firebase-id-token' })
  expect(screen.getByLabelText('Search notes, topics, people, or ask AI…')).toBeVisible()
})

it('keeps the welcome screen usable when Google sign-in fails', async () => {
  mockApi({ SignInOptions: () => withGoogle })
  mockGoogle.signIn.mockRejectedValueOnce(new Error(''))
  await renderRouter('./app', { initialUrl: '/' })
  await settle()
  await fireEvent.press(screen.getByTestId('welcome-google'))
  await settle()
  expect(screen.getByText('That sign-in did not work. Try again.')).toBeVisible()
  expect(screen.getByText('Continue with Google')).toBeVisible()
  expect(screen.getByText('Get Started Free')).toBeVisible()
})

it('says the build is not set up when Android rejects the client or the ID token is missing', async () => {
  mockApi({ SignInOptions: () => withGoogle })
  await renderRouter('./app', { initialUrl: '/sign-in' })
  await settle()
  mockGoogle.signIn.mockRejectedValueOnce(Object.assign(new Error('DEVELOPER_ERROR'), { code: '10' }))
  await fireEvent.press(screen.getByText('Continue with Google'))
  await settle()
  expect(screen.getByText(GOOGLE_SETUP_ERROR)).toBeVisible()
  expect(mockFirebase.signInWithCredential).not.toHaveBeenCalled()
  expect(mockGoogle.signOut).toHaveBeenCalled()

  mockGoogle.signIn.mockResolvedValueOnce({ type: 'success', data: { idToken: null } })
  await fireEvent.press(screen.getByText('Continue with Google'))
  await settle()
  expect(screen.getByText(GOOGLE_SETUP_ERROR)).toBeVisible()
  expect(mockFirebase.signInWithCredential).not.toHaveBeenCalled()
})

it('rewrites an invite-only refusal so Google is how an existing account is joined', async () => {
  mockApi({
    SignInOptions: () => withGoogle,
    SignInWithGoogle: () => ({ data: { signInWithGoogle: { __typename: 'AuthPayload', session: null, userErrors: [{ __typename: 'UserError', field: null, message: 'This beta is invite-only.', code: 'FORBIDDEN' }] } } }),
  })
  mockGoogle.signIn.mockResolvedValue({ type: 'success', data: { idToken: 'google-id-token' } })
  mockFirebase.signInWithCredential.mockResolvedValue({ user: { getIdToken: async () => 'firebase-id-token' } })
  await renderRouter('./app', { initialUrl: '/sign-in' })
  await settle()
  await fireEvent.press(screen.getByText('Continue with Google'))
  await settle()
  expect(screen.getByText(copy.errors.inviteOnly)).toBeVisible()
  expect(screen.queryByText('This beta is invite-only.')).toBeNull()
})

it('has no Google button when the API does not offer it', async () => {
  mockApi({ SignInOptions: () => signInOptions })
  await renderRouter('./app', { initialUrl: '/sign-in' })
  await settle()
  expect(screen.queryByText('Continue with Google')).toBeNull()
  await renderRouter('./app', { initialUrl: '/' })
  await settle()
  expect(screen.queryByTestId('welcome-google')).toBeNull()
  expect(screen.getByText('Get Started Free')).toBeVisible()
})
