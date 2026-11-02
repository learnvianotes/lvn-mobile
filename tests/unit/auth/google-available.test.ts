/** Google is offered from the public build config. The Firebase app id is not part of that check. */
function load(env: Record<string, string | undefined>) {
  jest.resetModules()
  jest.doMock('@/lib/env', () => ({ env }))
  return require('@/lib/auth/google') as typeof import('@/lib/auth/google')
}

const ready = {
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: '123-web.apps.googleusercontent.com',
  EXPO_PUBLIC_FIREBASE_API_KEY: 'firebase-key',
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'lvn-test.firebaseapp.com',
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'lvn-test',
}

it('is available without a Firebase app id', () => {
  expect(load(ready).googleAvailable()).toBe(true)
})

it('is unavailable without the web client id or the API key', () => {
  expect(load({ ...ready, EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: undefined }).googleAvailable()).toBe(false)
  expect(load({ ...ready, EXPO_PUBLIC_FIREBASE_API_KEY: '' }).googleAvailable()).toBe(false)
})
