import { ago, describeNotification } from '@/features/notifications/describe'
import { liveUrlFrom } from '@/lib/parse-env'

const meera = { id: 'u1', displayName: 'Meera Iyer' }
const say = (n: Partial<Parameters<typeof describeNotification>[0]>) => describeNotification({ category: 'SHARE', path: '/notes/n1', data: null, actor: null, note: null, ...n })

describe('notification sentences (lvn-backend ADR-0042)', () => {
  it('match the web: shares, verification, exports and imports', () => {
    expect(say({ actor: meera, note: { id: 'n1', title: 'Heaps' } })).toBe('Meera Iyer shared “Heaps” with you')
    expect(say({ actor: meera })).toBe('Meera Iyer shared a note with you that you can no longer open')
    expect(say({ category: 'VERIFICATION', data: { kind: 'REQUESTED' }, actor: meera })).toBe('Meera Iyer asked you to verify their account')
    expect(say({ category: 'VERIFICATION', data: { kind: 'DECIDED', decision: 'APPROVED' } })).toBe('Your account is verified')
    expect(say({ category: 'DATA_EXPORT' })).toBe('Your data export is ready to download')
    expect(say({ category: 'FOLLOW', actor: meera })).toBe('Meera Iyer started following you')
    expect(say({ category: 'CONNECTION', actor: meera, data: { kind: 'REQUESTED' } })).toBe('Meera Iyer wants to connect with you')
    expect(say({ category: 'CONNECTION', actor: meera, data: { kind: 'ACCEPTED' } })).toBe('Meera Iyer accepted your connection request')
    expect(say({ category: 'JOIN_REQUEST', actor: meera, group: { id: 'g', name: 'Algorithms study' } })).toBe('Meera Iyer asked to join Algorithms study')
    expect(say({ category: 'JOIN_DECISION', data: { decision: 'APPROVED' }, group: { id: 'g', name: 'Algorithms study' } })).toBe("You're in: Algorithms study accepted your request")
    expect(say({ category: 'NOTES_IMPORT', data: { created: 4, skipped: 2, failed: 1 } })).toBe('Your import is done: 4 notes added, 2 skipped, 1 could not be read')
    expect(say({ category: 'NOTES_IMPORT', data: { created: 1, skipped: 0, failed: 0 } })).toBe('Your import is done: 1 note added')
  })

  it('match the web for comments and replies (lvn-backend ADR-0047)', () => {
    const note = { id: 'n1', title: 'Heaps' }
    expect(say({ category: 'COMMENT', actor: meera, note, data: { kind: 'COMMENT' } })).toBe('Meera Iyer commented on “Heaps”')
    expect(say({ category: 'COMMENT', actor: meera, note, data: { kind: 'REPLY' } })).toBe('Meera Iyer replied to your comment on “Heaps”')
    expect(say({ category: 'COMMENT', path: '/groups/g1', actor: meera, group: { id: 'g1', name: 'Algorithms study' }, data: { kind: 'COMMENT' } })).toBe('Meera Iyer commented in Algorithms study')
    expect(say({ category: 'COMMENT', actor: meera, data: { kind: 'COMMENT' } })).toBe('Meera Iyer commented on something you can no longer open')
  })

  it('match the web for mentor invites and doubts (lvn-backend ADR-0048)', () => {
    const group = { id: 'g1', name: 'Heap visualiser' }
    expect(say({ category: 'MENTOR_INVITE', actor: meera, group })).toBe('Meera Iyer asked you to mentor Heap visualiser')
    expect(say({ category: 'DOUBT', actor: meera, group, data: { kind: 'ASKED' } })).toBe('Meera Iyer asked a doubt in Heap visualiser')
    expect(say({ category: 'DOUBT', actor: meera, group, data: { kind: 'ANSWERED' } })).toBe('Meera Iyer answered your doubt in Heap visualiser')
    expect(say({ category: 'DOUBT', actor: meera, group, data: { kind: 'RESOLVED' } })).toBe('Meera Iyer marked your doubt in Heap visualiser resolved')
  })

  it('match the web for moderation: what was decided and where, never why (lvn-backend ADR-0051)', () => {
    const group = { id: 'g1', name: 'Heaps club' }
    const classroom = { id: 'c1', name: 'Physics 9A' }
    expect(say({ category: 'MODERATION', group, path: '/groups/g1', data: { kind: 'HIDDEN', entityType: 'GROUP_POST' } })).toBe('Moderators hid your post in Heaps club. Open it to see why.')
    expect(say({ category: 'MODERATION', classroom, path: '/classes/c1', data: { kind: 'REMOVED', entityType: 'COMMENT' } })).toBe('Moderators removed your comment in Physics 9A. Open it to see why.')
    expect(say({ category: 'MODERATION', note: { id: 'n1', title: 'Heaps' }, data: { kind: 'HIDDEN', entityType: 'COMMENT' } })).toBe('Moderators hid your comment on “Heaps”. Open it to see why.')
    expect(say({ category: 'MODERATION', classroom, path: '/classes/c1', data: { kind: 'WARNED', entityType: 'CLASSROOM_POST' } })).toBe('Moderators left a warning on your announcement in Physics 9A.')
    expect(say({ category: 'MODERATION', group, path: '/groups/g1/doubts/d1', data: { kind: 'RESTORED', entityType: 'DOUBT' } })).toBe('Moderators put your doubt in Heaps club back.')
    expect(say({ category: 'MODERATION', group, path: '/groups/g1', data: { kind: 'WARNED', entityType: 'GROUP' } })).toBe('Moderators left a warning on your group Heaps club.')
    expect(say({ category: 'MODERATION', path: '/groups/g1', data: { kind: 'REMOVED', entityType: 'GROUP' } })).toBe('Moderators removed your group. Open it to see why.')
  })

  it('match the web for classes (lvn-backend ADR-0046)', () => {
    const c = { id: 'c1', name: 'Physics 9A' }
    const path = '/classes/c1'
    expect(say({ category: 'JOIN_REQUEST', path, actor: meera, classroom: c })).toBe('Meera Iyer asked to join Physics 9A')
    expect(say({ category: 'JOIN_DECISION', path, data: { decision: 'APPROVED' }, classroom: c })).toBe("You're in: Physics 9A accepted your request")
    expect(say({ category: 'JOIN_DECISION', path, data: { decision: 'REJECTED' } })).toBe("Your request to join a class wasn't accepted")
    expect(say({ category: 'CLASSROOM_INVITE', path, actor: meera, classroom: c })).toBe('Meera Iyer invited you to Physics 9A')
    expect(say({ category: 'CLASSROOM_POST', path, actor: meera, classroom: c })).toBe('Meera Iyer posted an announcement in Physics 9A')
  })

  it('says how long ago, without Intl.RelativeTimeFormat, which the phone does not have', () => {
    const real = Intl.RelativeTimeFormat
    // Hermes has no RelativeTimeFormat: the screen crashed on the emulator when ago() used it.
    ;(Intl as { RelativeTimeFormat?: unknown }).RelativeTimeFormat = undefined
    try {
      const now = Date.parse('2026-10-12T10:00:00Z')
      expect(ago('2026-10-12T09:59:30Z', now)).toBe('just now')
      expect(ago('2026-10-12T09:59:00Z', now)).toBe('1 minute ago')
      expect(ago('2026-10-12T09:55:00Z', now)).toBe('5 minutes ago')
      expect(ago('2026-10-12T07:00:00Z', now)).toBe('3 hours ago')
      expect(ago('2026-10-11T10:00:00Z', now)).toBe('yesterday')
      expect(ago('2026-09-28T10:00:00Z', now)).toBe('2 weeks ago')
      expect(ago('2026-10-12T10:00:05Z', now)).toBe('just now')
    } finally {
      ;(Intl as { RelativeTimeFormat?: unknown }).RelativeTimeFormat = real
    }
  })
})

describe('liveUrlFrom', () => {
  it('uses EXPO_PUBLIC_LIVE_URL, derives it only in development, and is off elsewhere', () => {
    expect(liveUrlFrom({ EXPO_PUBLIC_APP_ENV: 'sandbox', EXPO_PUBLIC_API_URL: 'http://h:8080/graphql', EXPO_PUBLIC_LIVE_URL: 'ws://h:8080/graphql/live' })).toBe('ws://h:8080/graphql/live')
    expect(liveUrlFrom({ EXPO_PUBLIC_APP_ENV: 'development', EXPO_PUBLIC_API_URL: 'http://100.70.234.41:4000/graphql', EXPO_PUBLIC_LIVE_URL: undefined })).toBe('ws://100.70.234.41:4000/graphql/live')
    expect(liveUrlFrom({ EXPO_PUBLIC_APP_ENV: 'production', EXPO_PUBLIC_API_URL: 'https://api.example.in/graphql', EXPO_PUBLIC_LIVE_URL: undefined })).toBeNull()
  })
})

it('tells a person about their own account: a warning, a suspension, and a suspension lifted (lvn-backend ADR-0053)', () => {
  const path = '/profile'
  expect(say({ category: 'MODERATION', path, data: { kind: 'WARNED', entityType: 'USER' } })).toBe('Moderators warned your account. Open your account to read why.')
  expect(say({ category: 'MODERATION', path, data: { kind: 'SUSPENDED', entityType: 'USER' } })).toBe('Moderators suspended your account. Open your account to see until when and why.')
  expect(say({ category: 'MODERATION', path, data: { kind: 'RESTORED', entityType: 'USER' } })).toBe('Your account’s suspension has ended early.')
})

it('says who mentioned the viewer and where, never what they wrote (lvn-backend ADR-0054)', () => {
  const meera = { __typename: 'User', id: 'u1', displayName: 'Meera Iyer' }
  expect(say({ category: 'MENTION', actor: meera, note: { id: 'n1', title: 'Heaps' }, data: { entityType: 'COMMENT' } } as never)).toBe('Meera Iyer mentioned you in a comment on “Heaps”')
  expect(say({ category: 'MENTION', actor: meera, group: { id: 'g1', name: 'Heaps club' }, path: '/groups/g1', data: { entityType: 'GROUP_POST' } } as never)).toBe('Meera Iyer mentioned you in a post in Heaps club')
  expect(say({ category: 'MENTION', actor: meera, path: '/groups/g1', data: { entityType: 'GROUP_POST' } } as never)).toBe('Meera Iyer mentioned you somewhere you can no longer open')
})
