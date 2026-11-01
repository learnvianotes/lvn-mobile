import type { ApolloClient } from '@apollo/client'
import { IngestAnalyticsDocument } from '@/graphql/generated/graphql'
import { getSession } from '@/lib/auth/session'

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const URLISH = /(?:https?:\/\/|file:\/\/)\S+/gi

/**
 * A client error message safe to store: no email address and no file or web address. The signed-in user id is added
 * by the API from the session, so it is not sent here.
 */
export function scrubClientMessage(message: string): string {
  return message.replace(EMAIL, '').replace(URLISH, '').replace(/\s+/g, ' ').trim().slice(0, 500)
}

/**
 * Reports one client error to ingestAnalytics (platform MOBILE) so it shows on web /admin/errors for this user.
 * Nothing is sent when nobody is signed in, and a failure to report is ignored.
 */
export function reportClientError(client: ApolloClient, error: { code: string; message: string }): void {
  if (!getSession().accessToken) return
  const message = scrubClientMessage(error.message)
  const code = scrubClientMessage(error.code).slice(0, 80)
  if (!code || !message) return
  void client
    .mutate({ mutation: IngestAnalyticsDocument, variables: { input: { errors: [{ code, message, platform: 'MOBILE', occurredAt: new Date().toISOString() }] } } })
    .catch(() => undefined)
}
