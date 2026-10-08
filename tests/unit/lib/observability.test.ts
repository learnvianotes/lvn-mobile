import type { ErrorEvent } from '@sentry/react-native'

const mockInit = jest.fn()
jest.mock('@sentry/react-native', () => ({ init: (options: unknown) => mockInit(options) }))
jest.mock('@/lib/env', () => ({ env: { EXPO_PUBLIC_APP_ENV: 'production' } }))
const mockEnv = (jest.requireMock('@/lib/env') as { env: Record<string, string | undefined> }).env

// eslint-disable-next-line import/first
import { scrubBreadcrumb, scrubEvent, startErrorReporting } from '@/lib/observability'

afterEach(() => mockInit.mockReset())

describe('startErrorReporting', () => {
  it('stays off without a DSN', () => {
    mockEnv.EXPO_PUBLIC_SENTRY_DSN = undefined
    expect(startErrorReporting()).toBe(false)
    expect(mockInit).not.toHaveBeenCalled()
  })

  it('reports errors only, without screenshots, the view hierarchy or personal data', () => {
    mockEnv.EXPO_PUBLIC_SENTRY_DSN = 'https://key@o1.ingest.sentry.io/2'
    expect(startErrorReporting()).toBe(true)
    const options = mockInit.mock.calls[0]![0]
    expect(options).toMatchObject({ dsn: 'https://key@o1.ingest.sentry.io/2', environment: 'production', sendDefaultPii: false, attachScreenshot: false, attachViewHierarchy: false })
    expect(options).not.toHaveProperty('tracesSampleRate')
  })
})

describe('scrubbing', () => {
  it('removes the user, request details and query strings, and drops console breadcrumbs', () => {
    const event = scrubEvent({
      type: undefined,
      user: { email: 'asha@example.com' },
      request: { url: 'learnvianotes://oauth/callback?code=provider-code', headers: { authorization: 'Bearer secret' }, query_string: 'code=provider-code' },
      breadcrumbs: [
        { category: 'console', message: 'asha@example.com' },
        { category: 'xhr', data: { url: 'https://api.learnvianotes.in/graphql?x=1', method: 'POST' } },
        { category: 'navigation', data: { from: '/sign-in', to: '/verify?code=1' } },
      ],
    } as ErrorEvent)
    const text = JSON.stringify(event)
    for (const secret of ['asha@example.com', 'provider-code', 'Bearer secret', 'x=1', 'code=1']) expect(text).not.toContain(secret)
    expect(event.breadcrumbs).toHaveLength(2)
    expect(scrubBreadcrumb({ category: 'touch', message: 'Sign in' })).toEqual({ category: 'touch', message: 'Sign in' })
  })
})
