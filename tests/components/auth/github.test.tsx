import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library'
import { signedOut } from '@/lib/auth/session'
import { mockApi, session, signInOptions, viewer } from '../../support/api'

/**
 * GitHub sign-in without GitHub: the system auth browser (expo-auth-session) is replaced by a stub that answers like
 * GitHub's redirect would. The API side of `oauthExchange` is covered by lvn-backend's e2e suite.
 */
jest.mock('@/lib/env', () => ({
  env: {
    EXPO_PUBLIC_APP_ENV: 'development',
    EXPO_PUBLIC_WEB_URL: 'http://web.test',
    EXPO_PUBLIC_API_URL: 'http://api.test/graphql',
    EXPO_PUBLIC_GITHUB_CLIENT_ID: 'gh-client',
    EXPO_PUBLIC_GITHUB_AUTHORIZE_URL: 'https://github.com/login/oauth/authorize',
  },
}))
const mockPrompt = jest.fn()
const mockRequests: unknown[] = []
jest.mock('expo-auth-session', () => ({
  makeRedirectUri: () => 'learnvianotes-dev://oauth/callback',
  ResponseType: { Code: 'code' },
  CodeChallengeMethod: { S256: 'S256' },
  AuthRequest: jest.fn().mockImplementation((config: unknown) => {
    mockRequests.push(config)
    return { codeVerifier: 'verifier-from-device', promptAsync: (discovery: unknown) => mockPrompt(discovery) }
  }),
}))

const settle = () => act(async () => void (await jest.advanceTimersByTimeAsync(500)))
const withGitHub = { data: { ...signInOptions.data, signInOptions: { ...signInOptions.data.signInOptions, github: true } } }

afterEach(async () => {
  await act(() => signedOut())
  mockPrompt.mockReset()
  mockRequests.length = 0
  jest.useRealTimers()
})

it('signs in with GitHub through PKCE and asks a new account for its details', async () => {
  mockPrompt.mockResolvedValue({ type: 'success', params: { code: 'code-from-github', state: 'checked-by-expo-auth-session' } })
  const api = mockApi({
    SignInOptions: () => withGitHub,
    OAuthExchange: () => ({ data: { oauthExchange: { __typename: 'AuthPayload', session: session(viewer({ registrationComplete: false })), userErrors: [] } } }),
    Viewer: () => ({ data: { viewer: viewer({ registrationComplete: false }) } }),
  })
  await renderRouter('./app', { initialUrl: '/sign-in' })
  await settle()
  await fireEvent.press(screen.getByText('Continue with GitHub'))
  await settle()
  expect(mockRequests[0]).toMatchObject({ clientId: 'gh-client', redirectUri: 'learnvianotes-dev://oauth/callback', usePKCE: true, codeChallengeMethod: 'S256', scopes: ['read:user', 'user:email'] })
  expect(mockPrompt).toHaveBeenCalledWith({ authorizationEndpoint: 'https://github.com/login/oauth/authorize' })
  expect(api.calls.find((c) => c.op === 'OAuthExchange')!.variables).toEqual({
    input: { provider: 'GITHUB', code: 'code-from-github', codeVerifier: 'verifier-from-device', redirectUri: 'learnvianotes-dev://oauth/callback' },
  })
  expect(screen.getByText(/^Almost there/)).toBeVisible()
})

it('does nothing when the browser is closed, and shows the API’s refusal', async () => {
  const api = mockApi({
    SignInOptions: () => withGitHub,
    OAuthExchange: () => ({ data: { oauthExchange: { __typename: 'AuthPayload', session: null, userErrors: [{ __typename: 'UserError', field: null, message: 'GitHub did not share a verified email address.', code: 'VALIDATION' }] } } }),
  })
  await renderRouter('./app', { initialUrl: '/sign-in' })
  await settle()
  mockPrompt.mockResolvedValueOnce({ type: 'dismiss' })
  await fireEvent.press(screen.getByText('Continue with GitHub'))
  await settle()
  expect(api.ops()).not.toContain('OAuthExchange')
  mockPrompt.mockResolvedValueOnce({ type: 'success', params: { code: 'c' } })
  await fireEvent.press(screen.getByText('Continue with GitHub'))
  await settle()
  expect(screen.getByText('GitHub did not share a verified email address.')).toBeVisible()
  expect(screen.getByText('Welcome back. Pick up where you left off.')).toBeVisible()
})

it('has no GitHub button when the API does not offer it', async () => {
  mockApi({ SignInOptions: () => signInOptions })
  await renderRouter('./app', { initialUrl: '/sign-in' })
  await settle()
  expect(screen.queryByText('Continue with GitHub')).toBeNull()
})
