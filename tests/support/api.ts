/**
 * A fake lvn-backend GraphQL endpoint in place of `fetch`: answers by operation name (the refresh is "Refresh"),
 * records every call with its headers, and returns `unmocked <op>` for anything without a handler.
 */
export type Handler = (variables: Record<string, unknown>, headers: Headers) => unknown

export interface Call {
  op: string
  variables: Record<string, unknown>
  headers: Headers
}

/**
 * A settled response without Node's stream-backed `Response`, whose body never resolves under expo-router's fake
 * timers. It has what Apollo's HttpLink and authFetch read.
 */
function json(body: unknown, status = 200): Response {
  const text = JSON.stringify(body)
  const make = (): Response =>
    ({
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => text,
      json: async () => JSON.parse(text),
      clone: make,
    }) as unknown as Response
  return make()
}

/** Answers every test gets unless it passes its own: uploads are on (lvn-backend ADR-0097), as on a developer's stack. */
const DEFAULTS: Record<string, Handler> = {
  UploadsEnabled: () => ({ data: { uploadsEnabled: true } }),
}

export function mockApi(handlers: Record<string, Handler>) {
  const calls: Call[] = []
  const fetchMock = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as { query: string; operationName?: string; variables?: Record<string, unknown> }
    const op = body.operationName ?? /(?:query|mutation)\s+(\w+)/.exec(body.query)?.[1] ?? 'unknown'
    const headers = new Headers(init?.headers)
    calls.push({ op, variables: body.variables ?? {}, headers })
    const handler = handlers[op] ?? DEFAULTS[op]
    if (!handler) return json({ errors: [{ message: `unmocked ${op}` }] }, 500)
    const result = handler(body.variables ?? {}, headers)
    if (result instanceof Error) throw result
    return json(result)
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch
  return { calls, fetch: fetchMock, ops: () => calls.map((c) => c.op) }
}

export const unauthenticated = { data: null, errors: [{ message: 'Your session has ended. Sign in again.', extensions: { code: 'UNAUTHENTICATED' } }] }

export const viewer = (over: Record<string, unknown> = {}) => ({
  __typename: 'User',
  id: '01920000-0000-7000-8000-00000000aaaa',
  handle: 'asharao',
  displayName: 'Asha Rao',
  email: 'asha@example.com',
  emailVerified: true,
  registrationComplete: true,
  verified: false,
  verificationMethod: null,
  teacherStatus: 'NONE',
  globalRole: 'STUDENT',
  restrictedMinor: false,
  institutionalEmail: null,
  institutionalEmailStatus: 'NONE',
  institution: null,
  deletionScheduledFor: null,
  ...over,
})

let n = 0
/** A session as the API issues it to a mobile client: a fresh token pair each time. */
export const session = (user = viewer(), minutes = 15) => {
  n += 1
  return {
    __typename: 'Session',
    accessToken: `access-${n}`,
    accessTokenExpiresAt: new Date(Date.now() + minutes * 60_000).toISOString(),
    refreshToken: `refresh-${n}`,
    user,
  }
}

export const problem = (field: string[] | null, message: string, code = 'VALIDATION') => ({ __typename: 'UserError', field, message, code })
export const ok = { __typename: 'OkPayload', ok: true, userErrors: [] }
export const signInOptions = { data: { signInOptions: { __typename: 'SignInOptions', emailPassword: true, google: false, emailCode: true, github: false, linkedin: false }, termsVersion: '2026-10-08' } }
