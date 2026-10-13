import type { NotificationFieldsFragment } from '@/graphql/generated/graphql'

const MODERATED: Record<string, string> = { COMMENT: 'your comment', GROUP_POST: 'your post', CLASSROOM_POST: 'your announcement', DOUBT: 'your doubt', GROUP: 'your group' }

type Described = Pick<NotificationFieldsFragment, 'category' | 'data' | 'actor' | 'note' | 'path'> & { group?: NotificationFieldsFragment['group']; classroom?: NotificationFieldsFragment['classroom'] }

/**
 * The sentence for a notification (lvn-backend ADR-0042), written here from its category, the actor's name and the
 * note's title, which the API resolved with its own read checks — the same sentences as lvn-web's.
 */
export function describeNotification(n: Described): string {
  const actor = n.actor?.displayName ?? 'Someone'
  const data = (n.data ?? {}) as Record<string, unknown>
  // Join requests and answers are about a group or a class (lvn-backend ADR-0046); a class may be gone from view.
  const place = n.classroom?.name ?? n.group?.name ?? null
  switch (n.category) {
    case 'SHARE':
      return n.note ? `${actor} shared “${n.note.title || 'Untitled note'}” with you` : `${actor} shared a note with you that you can no longer open`
    case 'VERIFICATION':
      if (data.kind === 'REQUESTED') return `${actor} asked you to verify their account`
      // An application to teach (lvn-backend ADR-0073).
      if (data.purpose === 'TEACHER_ROLE') return data.decision === 'APPROVED' ? 'You’re a verified teacher now: your classes can take students' : 'Your application to teach wasn’t approved; see why on Teach'
      if (data.decision === 'APPROVED') return n.actor ? `${actor} verified your account` : 'Your account is verified'
      return 'Your verification was not accepted. You can try again from your profile.'
    case 'FOLLOW':
      return `${actor} started following you`
    case 'JOIN_REQUEST':
      return `${actor} asked to join ${place ?? 'a group'}`
    case 'JOIN_DECISION':
      if (!place && n.path.startsWith('/classes/')) return data.decision === 'APPROVED' ? "You're in: your request to join a class was accepted" : "Your request to join a class wasn't accepted"
      return data.decision === 'APPROVED' ? `You're in: ${place ?? 'a group'} accepted your request` : `${place ?? 'A group'} didn't accept your request`
    case 'COMMENT': {
      const reply = data.kind === 'REPLY'
      if (n.note) return reply ? `${actor} replied to your comment on “${n.note.title || 'Untitled note'}”` : `${actor} commented on “${n.note.title || 'Untitled note'}”`
      if (place) return reply ? `${actor} replied to your comment in ${place}` : `${actor} commented in ${place}`
      if (!reply && n.path.startsWith('/resources/')) return `${actor} commented on your resource`
      return `${actor} commented on something you can no longer open`
    }
    case 'MENTOR_INVITE':
      return `${actor} asked you to mentor ${place ?? 'a group'}`
    case 'DOUBT': {
      const where = place ?? 'a group'
      if (data.kind === 'ANSWERED') return `${actor} answered your doubt in ${where}`
      if (data.kind === 'RESOLVED') return `${actor} marked your doubt in ${where} resolved`
      return `${actor} asked a doubt in ${where}`
    }
    case 'CLASSROOM_INVITE':
      return `${actor} invited you to ${place ?? 'a class'}`
    case 'CLASSROOM_POST':
      return `${actor} posted an announcement in ${place ?? 'a class'}`
    case 'QUIZ_PUBLISHED':
      // A quiz published to the viewer's class (lvn-backend ADR-0064); the notification opens it.
      return `${actor} published a quiz in ${place ?? 'a class'}`
    case 'REVISION_REMINDER':
      // An exam's revision task left today (lvn-backend ADR-0070): the exam is the viewer's own.
      return typeof data.examName === 'string' && data.examName ? `Today’s revision for ${data.examName} is waiting` : 'Today’s revision is waiting'
    case 'MENTION': {
      // Someone named the viewer with @handle (lvn-backend ADR-0054); where, never what they wrote.
      const thing = data.entityType === 'GROUP_POST' ? 'a post' : 'a comment'
      if (n.note) return `${actor} mentioned you in a comment on “${n.note.title || 'Untitled note'}”`
      if (place) return `${actor} mentioned you in ${thing} in ${place}`
      return `${actor} mentioned you somewhere you can no longer open`
    }
    case 'MODERATION': {
      // What a moderator decided about the viewer's own content (lvn-backend ADR-0051); the reason is shown with it.
      const type = typeof data.entityType === 'string' ? data.entityType : ''
      // About the account itself (ADR-0053): a warning, a suspension, or a suspension lifted.
      if (type === 'USER') return data.kind === 'SUSPENDED' ? 'Moderators suspended your account. Open your account to see until when and why.' : data.kind === 'RESTORED' ? 'Your account’s suspension has ended early.' : 'Moderators warned your account. Open your account to read why.'
      const thing = MODERATED[type] ?? 'something you posted'
      const what = type === 'GROUP' ? (place ? `your group ${place}` : thing) : n.note ? `${thing} on “${n.note.title || 'Untitled note'}”` : place ? `${thing} in ${place}` : thing
      // A removed group's owner opens it to read why and appeal (ADR-0053).
      if (data.kind === 'REMOVED') return `Moderators removed ${what}. Open it to see why.`
      if (data.kind === 'WARNED') return `Moderators left a warning on ${what}.`
      if (data.kind === 'RESTORED') return `Moderators put ${what} back.`
      return `Moderators hid ${what}. Open it to see why.`
    }
    case 'CONNECTION':
      return data.kind === 'ACCEPTED' ? `${actor} accepted your connection request` : `${actor} wants to connect with you`
    case 'RESOURCE':
      // Someone recommended one to the viewer (ADR-0075), or moderators decided on one they sent (ADR-0074).
      if (data.kind === 'RECOMMENDED') return `${actor} recommended a resource to you`
      return data.decision === 'APPROVED' ? 'Your resource is in the catalogue' : 'Moderators did not approve your resource'
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
