import { useSyncExternalStore } from 'react'
import { env } from '@/lib/env'
import { fetchWithDeadline } from '@/lib/net/deadline'
import { clearTokens, loadTokens, saveTokens } from './storage'

/**
 * The signed-in session of this device (§7.1). Both tokens live in expo-secure-store; this module keeps the current
 * access token in memory, refreshes it a minute before it expires, and tells the navigator who is signed in.
 */
export interface SessionState {
  status: 'restoring' | 'signed-in' | 'signed-out'
  accessToken: string | null
  /** From the last session the API sent; null when restored offline (the app then lets the person in). */
  registrationComplete: boolean | null
}

/** What every session payload carries (SessionFields in graphql/operations/auth.graphql). */
export interface IssuedSession {
  accessToken: string
  accessTokenExpiresAt: string
  refreshToken: string | null
  user: { registrationComplete: boolean }
}

const EARLY_MS = 60_000
const listeners = new Set<() => void>()
let state: SessionState = { status: 'restoring', accessToken: null, registrationComplete: null }
let timer: ReturnType<typeof setTimeout> | undefined
let inFlight: Promise<boolean> | null = null
/** A screen to open once the signed-in screens are mounted, e.g. the code entry after sign-up. */
let pendingRoute: string | null = null

function set(next: Partial<SessionState>): void {
  state = { ...state, ...next }
  listeners.forEach((l) => l())
}

export const getSession = (): SessionState => state

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSession<T>(select: (s: SessionState) => T): T {
  return useSyncExternalStore(subscribeSession, () => select(state))
}

function schedule(expiresAt: string): void {
  clearTimeout(timer)
  timer = setTimeout(() => void refreshSession(), Math.max(5_000, Date.parse(expiresAt) - Date.now() - EARLY_MS))
}

/** Stores a session the API just issued (sign-in, sign-up, provider sign-in or refresh). */
export async function signedIn(session: IssuedSession, then?: string): Promise<void> {
  if (!session.refreshToken) throw new Error('The API sent no refresh token; is the X-LVN-Client header missing?')
  await saveTokens({ accessToken: session.accessToken, accessTokenExpiresAt: session.accessTokenExpiresAt, refreshToken: session.refreshToken })
  pendingRoute = then ?? null
  schedule(session.accessTokenExpiresAt)
  set({ status: 'signed-in', accessToken: session.accessToken, registrationComplete: session.user.registrationComplete })
}

/** The registration details were saved (provider sign-ups, ADR-0017). */
export function registrationCompleted(then?: string): void {
  pendingRoute = then ?? null
  set({ registrationComplete: true })
}

/** The route a sign-in asked for, once; null when there is none. */
export function takePendingRoute(): string | null {
  const route = pendingRoute
  pendingRoute = null
  return route
}

export async function signedOut(): Promise<void> {
  clearTimeout(timer)
  pendingRoute = null
  await clearTokens()
  set({ status: 'signed-out', accessToken: null, registrationComplete: null })
}

const REFRESH = `mutation Refresh($refreshToken: String!) {
  refreshSession(input: { refreshToken: $refreshToken }) {
    session { accessToken accessTokenExpiresAt refreshToken user { registrationComplete } }
  }
}`

/**
 * Exchanges the stored refresh token for a new pair. One refresh at a time (single-flight): the API rotates the
 * refresh token on every use and treats a reused one as theft (§7.1), so concurrent callers share one request.
 * Offline, the session is kept and the next request tries again; a refusal from the API signs the person out.
 */
export function refreshSession(): Promise<boolean> {
  inFlight ??= (async () => {
    try {
      const stored = await loadTokens()
      if (!stored) {
        await signedOut()
        return false
      }
      let body: { data?: { refreshSession?: { session?: IssuedSession } } | null; errors?: { extensions?: { code?: string } }[] }
      try {
        const res = await fetchWithDeadline(env.EXPO_PUBLIC_API_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-lvn-client': 'mobile' },
          body: JSON.stringify({ query: REFRESH, variables: { refreshToken: stored.refreshToken } }),
        })
        body = (await res.json()) as typeof body
      } catch {
        if (state.status === 'restoring') set({ status: 'signed-in', accessToken: stored.accessToken || null })
        return true
      }
      const session = body.data?.refreshSession?.session
      if (!session) {
        // Only the API's refusal ends the session; a server fault is treated like being offline.
        if (body.errors?.some((e) => e.extensions?.code === 'UNAUTHENTICATED')) {
          await signedOut()
          return false
        }
        if (state.status === 'restoring') set({ status: 'signed-in', accessToken: stored.accessToken || null })
        return state.status === 'signed-in'
      }
      await signedIn(session, pendingRoute ?? undefined)
      return true
    } finally {
      inFlight = null
    }
  })()
  return inFlight
}

/** Ask again after "LearnViaNotes did not answer". */
export async function retryRestore(): Promise<void> {
  set({ status: 'restoring' })
  await restoreSession()
}

/** On launch: signed out without a stored refresh token; otherwise the session is renewed (or kept, offline). */
export async function restoreSession(): Promise<void> {
  if (state.status !== 'restoring') return
  const stored = await loadTokens()
  if (!stored) {
    set({ status: 'signed-out' })
    return
  }
  await refreshSession()
}
