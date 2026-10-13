import type { NotificationCategory } from '@/graphql/generated/graphql'

/** What each notification category is called in the settings (the same words as the web's). */
export const LABEL: Partial<Record<NotificationCategory, string>> = {
  SHARE: 'Notes shared with you', COMMENT: 'Comments and replies', FOLLOW: 'New followers', CONNECTION: 'Connections', JOIN_REQUEST: 'Requests to join your groups and classes',
  JOIN_DECISION: 'Answers to your requests to join', CLASSROOM_INVITE: 'Class invites', CLASSROOM_POST: 'Class announcements', QUIZ_PUBLISHED: 'Quizzes in your classes', MENTOR_INVITE: 'Invites to mentor', DOUBT: 'Doubts', MENTION: 'Mentions of you',
  VERIFICATION: 'Verification', DATA_EXPORT: 'Data exports', NOTES_IMPORT: 'Imports', REVISION_REMINDER: 'Revision reminders for your exams',
  RHYTHM_BUDDY: 'Rhythm buddies', RESOURCE: 'Resources: recommendations and decisions',
}
