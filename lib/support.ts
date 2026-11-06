/** The only address shown for help, terms, privacy, and account questions. */
export const SUPPORT_EMAIL = 'support@learnvianotes.in'

/** A mailto link for {@link SUPPORT_EMAIL}. */
export function supportMailto(): string {
  return `mailto:${SUPPORT_EMAIL}`
}
