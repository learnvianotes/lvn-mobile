import type { ModerationState, ReportEntityType, ReportReason } from '@/graphql/generated/graphql'

/** Words for moderation on the phone (lvn-backend ADR-0037, ADR-0051), the same as lvn-web's. */
export const REASONS: { reason: ReportReason; label: string; hint: string }[] = [
  { reason: 'SPAM', label: 'Spam or advertising', hint: 'Ads, links or the same text again and again' },
  { reason: 'HARASSMENT', label: 'Bullying or harassment', hint: 'Aimed at hurting or shaming someone' },
  { reason: 'HATE', label: 'Hate', hint: 'Attacks people for who they are' },
  { reason: 'SEXUAL', label: 'Sexual content', hint: 'Not for a study app' },
  { reason: 'SELF_HARM', label: 'Self-harm', hint: 'Encourages hurting oneself' },
  { reason: 'COPYRIGHT', label: 'Copied without permission', hint: 'Someone else’s work, shared without their permission' },
  { reason: 'OTHER', label: 'Something else', hint: 'Tell us below' },
]

export const REASON_LABEL = Object.fromEntries(REASONS.map((r) => [r.reason, r.label])) as Record<ReportReason, string>

export const REPORT_TITLE: Record<ReportEntityType, string> = {
  NOTE: 'Report this note',
  USER: 'Report this person',
  COMMENT: 'Report this comment',
  GROUP_POST: 'Report this post',
  CLASSROOM_POST: 'Report this announcement',
  DOUBT: 'Report this doubt',
  GROUP: 'Report this group',
}

export const ENTITY: Record<ReportEntityType, string> = { NOTE: 'Note', USER: 'Account', COMMENT: 'Comment', GROUP_POST: 'Post', CLASSROOM_POST: 'Announcement', DOUBT: 'Doubt', GROUP: 'Group' }

export const STATE: Record<ModerationState, string> = { OK: 'Up', PENDING_REVIEW: 'Held', HIDDEN: 'Hidden', REMOVED: 'Removed' }
