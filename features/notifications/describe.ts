import type { NotificationFieldsFragment } from '@/graphql/generated/graphql'

type Described = Pick<NotificationFieldsFragment, 'category' | 'data' | 'actor' | 'note'>

/**
 * The sentence for a notification (lvn-backend ADR-0042), written here from its category, the actor's name and the
 * note's title, which the API resolved with its own read checks — the same sentences as lvn-web's.
 */
export function describeNotification(n: Described): string {
  const actor = n.actor?.displayName ?? 'Someone'
  const data = (n.data ?? {}) as Record<string, unknown>
  switch (n.category) {
    case 'SHARE':
      return n.note ? `${actor} shared “${n.note.title || 'Untitled note'}” with you` : `${actor} shared a note with you that you can no longer open`
    case 'VERIFICATION':
      if (data.kind === 'REQUESTED') return `${actor} asked you to verify their account`
      if (data.decision === 'APPROVED') return n.actor ? `${actor} verified your account` : 'Your account is verified'
      return 'Your verification was not accepted. You can try again from your profile.'
    case 'DATA_EXPORT':
      return 'Your data export is ready to download'
    case 'NOTES_IMPORT': {
      const count = (k: string) => (typeof data[k] === 'number' ? (data[k] as number) : 0)
      const parts = [`${count('created')} ${count('created') === 1 ? 'note' : 'notes'} added`]
      if (count('skipped')) parts.push(`${count('skipped')} skipped`)
      if (count('failed')) parts.push(`${count('failed')} could not be read`)
      return `Your import is done: ${parts.join(', ')}`
    }
    default:
      return 'Something new for you'
  }
}

/** "5 minutes ago", "yesterday" */
export function ago(iso: string, now = Date.now()): string {
  const seconds = (Date.parse(iso) - now) / 1000
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  for (const [unit, size] of [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]] as const) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit)
  }
  return rtf.format(0, 'minute')
}
