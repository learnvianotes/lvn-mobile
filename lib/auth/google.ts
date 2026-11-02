import { env } from '@/lib/env'

/**
 * Shown when Google or Firebase rejects this build's OAuth client (Android status 10, a null ID token, or a Firebase
 * API key that only the website may use). The exact console values belong in the build's env, not in the app.
 */
export const GOOGLE_SETUP_ERROR = 'Google sign-in is not available on this build. Use email and password.'

/**
 * Google sign-in needs a Web OAuth client id and the Firebase web config that exchanges it.
 * The Firebase app id is not required for that exchange. Sandbox and production leave these empty, so those
 * builds offer email and password only — see the mobile addendum, Sign-in.
 */
export function googleAvailable(): boolean {
  return !!(
    env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID &&
    env.EXPO_PUBLIC_FIREBASE_API_KEY &&
    env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN &&
    env.EXPO_PUBLIC_FIREBASE_PROJECT_ID
  )
}

type GoogleSignInModule = typeof import('@react-native-google-signin/google-signin')
type FirebaseAppModule = typeof import('firebase/app')
type FirebaseAuthModule = typeof import('firebase/auth')

// Loaded on first use (inline requires, which Metro and Jest both resolve), so builds and sessions without Google
// sign-in never evaluate them.
/* eslint-disable @typescript-eslint/no-require-imports */
const googleSignIn = () => require('@react-native-google-signin/google-signin') as GoogleSignInModule
const firebaseApp = () => require('firebase/app') as FirebaseAppModule
const firebaseAuthModule = () => require('firebase/auth') as FirebaseAuthModule
/* eslint-enable @typescript-eslint/no-require-imports */

let firebaseAuth: import('firebase/auth').Auth | undefined

/** One Firebase app and Auth instance, kept in memory only: nothing Firebase signs in survives the exchange. */
function auth() {
  if (!firebaseAuth) {
    const { getApps, initializeApp } = firebaseApp()
    const { initializeAuth, getAuth, inMemoryPersistence } = firebaseAuthModule()
    const app =
      getApps()[0] ??
      initializeApp({
        apiKey: env.EXPO_PUBLIC_FIREBASE_API_KEY,
        authDomain: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
        ...(env.EXPO_PUBLIC_FIREBASE_APP_ID ? { appId: env.EXPO_PUBLIC_FIREBASE_APP_ID } : {}),
      })
    try {
      firebaseAuth = initializeAuth(app, { persistence: inMemoryPersistence })
    } catch (e) {
      // Fast refresh, or a second load of this module, finds Auth already attached to the app.
      const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : ''
      if (code === 'auth/already-initialized' || (e instanceof Error && e.message.includes('already-initialized'))) firebaseAuth = getAuth(app)
      else throw e
    }
  }
  return firebaseAuth
}

/** Play services status 10, or a Firebase web key that rejects the phone. Other failures keep their own message. */
function configFailure(e: unknown): string | null {
  const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : ''
  const message = e instanceof Error ? e.message : ''
  if (code === '10' || code === 'DEVELOPER_ERROR' || message.includes('DEVELOPER_ERROR')) return GOOGLE_SETUP_ERROR
  if (/auth\/(invalid-api-key|api-key-not-valid|app-not-authorized|operation-not-allowed|unauthorized-domain)/.test(message)) return GOOGLE_SETUP_ERROR
  return null
}

/**
 * Google sign-in as ADR-0007 describes it: native Google Sign-In returns a Google ID token (email scope, so the
 * address is in the token); Firebase exchanges it for the Firebase ID token `signInWithGoogle` verifies. The API
 * links that verified email to an existing account. Both are signed out straight after. Null when the person cancelled.
 */
export async function googleIdToken(): Promise<string | null> {
  const { GoogleSignin, isCancelledResponse } = googleSignIn()
  const iosClientId = env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
  GoogleSignin.configure({
    webClientId: env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    ...(iosClientId ? { iosClientId } : {}),
    scopes: ['openid', 'email', 'profile'],
  })
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
  try {
    const response = await GoogleSignin.signIn()
    if (isCancelledResponse(response)) return null
    // A null ID token is the Web client id missing or not a Web client, or Android's package and SHA-1 not registered.
    const googleToken = response.data.idToken
    if (!googleToken) throw new Error(GOOGLE_SETUP_ERROR)
    const { GoogleAuthProvider, signInWithCredential, signOut } = firebaseAuthModule()
    const firebase = auth()
    const { user } = await signInWithCredential(firebase, GoogleAuthProvider.credential(googleToken))
    try {
      return await user.getIdToken()
    } finally {
      await signOut(firebase)
    }
  } catch (e) {
    if (e instanceof Error && e.message === GOOGLE_SETUP_ERROR) throw e
    const mapped = configFailure(e)
    if (mapped) throw new Error(mapped)
    throw e
  } finally {
    // The next sign-in shows the account chooser again (shared phones).
    await GoogleSignin.signOut().catch(() => undefined)
  }
}
