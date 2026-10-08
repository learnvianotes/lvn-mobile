import { mockApi, session, unauthenticated } from '../../support/api'

function load() {
  jest.resetModules()
  ;(require('../../support/secure-store') as typeof import('../../support/secure-store')).items.clear()
  return {
    s: require('@/lib/auth/session') as typeof import('@/lib/auth/session'),
    authFetch: (require('@/lib/apollo') as typeof import('@/lib/apollo')).authFetch,
  }
}

const query = (op: string) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ operationName: op, query: `query ${op} { viewer { id } }` }) })

beforeEach(() => jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }))
afterEach(() => {
  jest.clearAllTimers()
  jest.useRealTimers()
})

describe('authFetch', () => {
  it('identifies the mobile client on every request and adds the access token when signed in', async () => {
    const api = mockApi({ Viewer: () => ({ data: { viewer: null } }) })
    const { s, authFetch } = load()
    await authFetch('http://api.test/graphql', query('Viewer'))
    expect(api.calls[0]!.headers.get('x-lvn-client')).toBe('mobile')
    expect(api.calls[0]!.headers.get('authorization')).toBeNull()
    const issued = session()
    await s.signedIn(issued)
    await authFetch('http://api.test/graphql', query('Viewer'))
    expect(api.calls[1]!.headers.get('authorization')).toBe(`Bearer ${issued.accessToken}`)
  })

  it('refreshes once and retries when the API says the token is no longer valid', async () => {
    const renewed = session()
    let first = true
    const api = mockApi({
      Viewer: (_v, headers) => {
        if (first) {
          first = false
          return unauthenticated
        }
        return { data: { viewer: { id: headers.get('authorization') } } }
      },
      Refresh: () => ({ data: { refreshSession: { session: renewed } } }),
    })
    const { s, authFetch } = load()
    await s.signedIn(session())
    const res = await authFetch('http://api.test/graphql', query('Viewer'))
    expect(api.ops()).toEqual(['Viewer', 'Refresh', 'Viewer'])
    expect(await res.json()).toEqual({ data: { viewer: { id: `Bearer ${renewed.accessToken}` } } })
  })

  it('returns the refusal and signs out when the refresh is refused too', async () => {
    const api = mockApi({ Viewer: () => unauthenticated, Refresh: () => unauthenticated })
    const { s, authFetch } = load()
    await s.signedIn(session())
    const res = await authFetch('http://api.test/graphql', query('Viewer'))
    expect((await res.json()).errors[0].extensions.code).toBe('UNAUTHENTICATED')
    expect(api.ops()).toEqual(['Viewer', 'Refresh'])
    expect(s.getSession().status).toBe('signed-out')
  })
})
