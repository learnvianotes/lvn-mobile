import { env } from '@/lib/env'

/** Google sign-in is offered only when this build has the Firebase web config and Google's web client id. */
export function googleAvailable(): boolean {
  return !!(
    env.EXPO_PUBLIC_FIREBASE_API_KEY &&
    env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN &&
    env.EXPO_PUBLIC_FIREBASE_PROJECT_ID &&
    env.EXPO_PUBLIC_FIREBASE_APP_ID &&
    env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
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
    const { initializeAuth, inMemoryPersistence } = firebaseAuthModule()
    const app =
      getApps()[0] ??
      initializeApp({
        apiKey: env.EXPO_PUBLIC_FIREBASE_API_KEY,
        authDomain: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
        appId: env.EXPO_PUBLIC_FIREBASE_APP_ID,
      })
    firebaseAuth = initializeAuth(app, { persistence: inMemoryPersistence })
  }
  return firebaseAuth
}

/**
 * Google sign-in as ADR-0007 describes it for the app: native Google Sign-In picks the account and returns a Google ID
 * token; Firebase exchanges it for a Firebase ID token, which is what the API's signInWithGoogle accepts. Both are
 * signed out straight after, so nothing stays signed in besides LVN's own session. Null when the person cancelled.
 */
export async function googleIdToken(): Promise<string | null> {
  const { GoogleSignin, isCancelledResponse } = googleSignIn()
  GoogleSignin.configure({ webClientId: env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, iosClientId: env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID })
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
  const response = await GoogleSignin.signIn()
  if (isCancelledResponse(response)) return null
  try {
    const googleToken = response.data.idToken
    if (!googleToken) throw new Error('Google returned no ID token.')
    const { GoogleAuthProvider, signInWithCredential, signOut } = firebaseAuthModule()
    const firebase = auth()
    const { user } = await signInWithCredential(firebase, GoogleAuthProvider.credential(googleToken))
    try {
      return await user.getIdToken()
    } finally {
      await signOut(firebase)
    }
  } finally {
    // The next sign-in shows the account chooser again (shared phones).
    await GoogleSignin.signOut().catch(() => undefined)
  }
}
