import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client'
import { env } from '@/lib/env'
import { fetchWithDeadline } from '@/lib/net/deadline'
import { getSession, refreshSession } from './auth/session'

const isUnauthenticated = (body: { errors?: { extensions?: { code?: string } }[] }) => body.errors?.some((e) => e.extensions?.code === 'UNAUTHENTICATED') ?? false

/**
 * Sends the access token and `X-LVN-Client: mobile` (so session payloads carry the refresh token instead of setting
 * a cookie). When the API answers UNAUTHENTICATED to a request that carried a token — it expired or the session was
 * revoked — refreshes once and retries.
 */
export const authFetch: typeof fetch = async (input, init) => {
  const send = (token: string | null) => {
    const headers = new Headers(init?.headers)
    headers.set('x-lvn-client', 'mobile')
    if (token) headers.set('authorization', `Bearer ${token}`)
    return fetchWithDeadline(input, { ...init, headers })
  }
  const token = getSession().accessToken
  const res = await send(token)
  if (!token) return res
  const body = await res.clone().json().catch(() => ({}))
  if (!isUnauthenticated(body)) return res
  return (await refreshSession()) ? send(getSession().accessToken) : res
}

export function createApolloClient(): ApolloClient {
  return new ApolloClient({
    link: new HttpLink({ uri: env.EXPO_PUBLIC_API_URL, fetch: authFetch }),
    // A note's people and tags are whole lists: the server's answer replaces what was cached (after an unshare, say).
    // A quiz choice's id is unique only within its question, so choices are kept inside their question, not by id.
    // A profile has no id: questions that read different parts of it merge them rather than replace each other.
    cache: new InMemoryCache({ typePolicies: { Note: { fields: { shares: { merge: false }, tags: { merge: false }, topics: { merge: false } } }, ClassQuizChoice: { keyFields: false }, StudentProfile: { merge: true } } }),
    defaultOptions: { watchQuery: { fetchPolicy: 'cache-and-network' } },
  })
}
