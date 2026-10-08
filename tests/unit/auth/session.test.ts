import { mockApi, session, unauthenticated, viewer } from '../../support/api'

type SessionModule = typeof import('@/lib/auth/session')

/** A fresh session module (its state is module-level) and the secure store it writes to. */
function load(stored?: { access?: string; expires?: string; refresh?: string }) {
  jest.resetModules()
  const { items } = require('../../support/secure-store') as typeof import('../../support/secure-store')
  items.clear()
  if (stored?.refresh) items.set('lvn.refreshToken', stored.refresh)
  if (stored?.access) items.set('lvn.accessToken', stored.access)
  if (stored?.expires) items.set('lvn.accessTokenExpiresAt', stored.expires)
  return { s: require('@/lib/auth/session') as SessionModule, items }
}

// Fake timers throughout: every signed-in session schedules its own renewal, which must not outlive the test.
beforeEach(() => jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }))
afterEach(() => {
  jest.clearAllTimers()
  jest.useRealTimers()
})

describe('restoring the session on launch', () => {
  it('is signed out when nothing is stored, without calling the API', async () => {
    const api = mockApi({})
    const { s } = load()
    await s.restoreSession()
    expect(s.getSession().status).toBe('signed-out')
    expect(api.calls).toHaveLength(0)
  })

  it('exchanges the stored refresh token as a mobile client and stores the rotated pair', async () => {
    const issued = session(viewer({ registrationComplete: false }))
    const api = mockApi({ Refresh: () => ({ data: { refreshSession: { session: issued } } }) })
    const { s, items } = load({ refresh: 'refresh-old', access: 'access-old', expires: new Date().toISOString() })
    await s.restoreSession()
    expect(api.calls[0]).toMatchObject({ op: 'Refresh', variables: { refreshToken: 'refresh-old' } })
    expect(api.calls[0]!.headers.get('x-lvn-client')).toBe('mobile')
    expect(s.getSession()).toEqual({ status: 'signed-in', accessToken: issued.accessToken, registrationComplete: false })
    expect(items.get('lvn.refreshToken')).toBe(issued.refreshToken)
    expect(items.get('lvn.accessToken')).toBe(issued.accessToken)
  })

  it('signs out and forgets the tokens when the API refuses them (expired, revoked or reused)', async () => {
    mockApi({ Refresh: () => unauthenticated })
    const { s, items } = load({ refresh: 'refresh-stolen' })
    await s.restoreSession()
    expect(s.getSession().status).toBe('signed-out')
    expect(items.size).toBe(0)
  })

  it('stays signed in offline, keeping the tokens for the next try', async () => {
    mockApi({ Refresh: () => new TypeError('Network request failed') })
    const { s, items } = load({ refresh: 'refresh-1', access: 'access-1' })
    await s.restoreSession()
    expect(s.getSession()).toMatchObject({ status: 'signed-in', accessToken: 'access-1', registrationComplete: null })
    expect(items.get('lvn.refreshToken')).toBe('refresh-1')
  })

  it('treats a server fault like being offline, not like a refusal', async () => {
    mockApi({ Refresh: () => ({ data: null, errors: [{ message: 'Internal', extensions: { code: 'INTERNAL' } }] }) })
    const { s, items } = load({ refresh: 'refresh-1', access: 'access-1' })
    await s.restoreSession()
    expect(s.getSession().status).toBe('signed-in')
    expect(items.get('lvn.refreshToken')).toBe('refresh-1')
  })
})

describe('refreshing', () => {
  it('sends one request however many callers ask at once (the API treats a reused token as theft)', async () => {
    const api = mockApi({ Refresh: () => ({ data: { refreshSession: { session: session() } } }) })
    const { s } = load({ refresh: 'refresh-1' })
    const results = await Promise.all([s.refreshSession(), s.refreshSession(), s.refreshSession()])
    expect(results).toEqual([true, true, true])
    expect(api.ops()).toEqual(['Refresh'])
  })

  it('renews the access token a minute before it expires', async () => {
    const api = mockApi({ Refresh: () => ({ data: { refreshSession: { session: session() } } }) })
    const { s } = load()
    await s.signedIn(session(viewer(), 15))
    jest.advanceTimersByTime(13 * 60_000)
    expect(api.calls).toHaveLength(0)
    await jest.advanceTimersByTimeAsync(60_000 + 1)
    expect(api.ops()).toEqual(['Refresh'])
  })
})

describe('signing in and out', () => {
  it('refuses a session without a refresh token (the X-LVN-Client header was not sent)', async () => {
    const { s } = load()
    await expect(s.signedIn({ ...session(), refreshToken: null })).rejects.toThrow(/X-LVN-Client/)
    expect(s.getSession().status).toBe('restoring')
  })

  it('remembers where to go next exactly once', async () => {
    const { s } = load()
    await s.signedIn(session(), '/verify')
    expect(s.takePendingRoute()).toBe('/verify')
    expect(s.takePendingRoute()).toBeNull()
  })

  it('notifies subscribers and clears everything on sign-out', async () => {
    const { s, items } = load()
    const seen: string[] = []
    s.subscribeSession(() => seen.push(s.getSession().status))
    await s.signedIn(session())
    s.registrationCompleted()
    await s.signedOut()
    expect(seen).toEqual(['signed-in', 'signed-in', 'signed-out'])
    expect(items.size).toBe(0)
  })
})
