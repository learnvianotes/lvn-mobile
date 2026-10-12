import type { NotificationFieldsFragment } from '@/graphql/generated/graphql'

type Described = Pick<NotificationFieldsFragment, 'category' | 'data' | 'actor' | 'note'> & { group?: NotificationFieldsFragment['group'] }

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
    case 'FOLLOW':
      return `${actor} started following you`
    case 'JOIN_REQUEST':
      return `${actor} asked to join ${n.group?.name ?? 'a group'}`
    case 'JOIN_DECISION':
      return data.decision === 'APPROVED' ? `You're in: ${n.group?.name ?? 'a group'} accepted your request` : `${n.group?.name ?? 'A group'} didn't accept your request`
    case 'CONNECTION':
      return data.kind === 'ACCEPTED' ? `${actor} accepted your connection request` : `${actor} wants to connect with you`
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

/**
 * "5 minutes ago", "yesterday". Written out by hand: Hermes, the phone's JavaScript engine, has no
 * Intl.RelativeTimeFormat (Node, where the tests run, does).
 */
export function ago(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000))
  for (const [unit, size] of [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]] as const) {
    const n = Math.floor(seconds / size)
    if (n < 1) continue
    if (unit === 'day' && n === 1) return 'yesterday'
    return `${n} ${unit}${n === 1 ? '' : 's'} ago`
  }
  return 'just now'
}
