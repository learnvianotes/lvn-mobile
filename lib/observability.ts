import * as Sentry from '@sentry/react-native'
import type { Breadcrumb, ErrorEvent } from '@sentry/react-native'
import { env } from './env'

/**
 * Crashes and unexpected JS errors to Sentry (§16.5), on only when EXPO_PUBLIC_SENTRY_DSN is set. Errors only — no
 * performance tracing, screenshots or view hierarchy — and nothing personal: no user, no console output, no query
 * strings (sign-in redirects carry codes in them).
 */
export function startErrorReporting(): boolean {
  const dsn = env.EXPO_PUBLIC_SENTRY_DSN
  if (!dsn) return false
  Sentry.init({
    dsn,
    environment: env.EXPO_PUBLIC_APP_ENV,
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  })
  return true
}

const withoutQuery = (url: unknown) => (typeof url === 'string' ? url.split(/[?#]/)[0] : url)

export function scrubEvent<E extends ErrorEvent>(event: E): E {
  delete event.user
  if (event.request) {
    delete event.request.cookies
    delete event.request.data
    delete event.request.query_string
    delete event.request.headers
    event.request.url = withoutQuery(event.request.url) as string | undefined
  }
  if (event.breadcrumbs) event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb).filter((b): b is Breadcrumb => b !== null)
  return event
}

/** Console output is dropped; URLs keep their path only. */
export function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb | null {
  if (crumb.category === 'console') return null
  if (!crumb.data) return crumb
  const data: Record<string, unknown> = { ...crumb.data }
  for (const key of ['url', 'from', 'to']) if (key in data) data[key] = withoutQuery(data[key])
  return { ...crumb, data }
}
