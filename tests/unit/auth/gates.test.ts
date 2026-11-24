import { accountGateCopy, needsVerifyPrompt, shareGateCopy } from '@/features/auth/gates'
import { stackVerifyActions } from '@/features/auth/VerifyEmailBanner'

it('names only the dotted actions the API says are gated', () => {
  expect(accountGateCopy([])).toBeNull()
  expect(accountGateCopy(['note.publish', 'note.share'])).toBe('You can keep notes, study and use your classes. Publishing a note and sharing a note waits until this account is verified.')
  expect(accountGateCopy(['note.publish', 'note.share', 'contest.enter', 'payout.request', 'ai.bulk', 'resource.submit'])).toBe(
    'You can keep notes, study and use your classes. Publishing a note, sharing a note, entering a contest, requesting a payout, running bulk Nova requests and submitting a resource waits until this account is verified.',
  )
  expect(accountGateCopy(['CHANGE_NOTE_VISIBILITY'])).toBe('Some features wait until this account is verified. You can keep notes, study and use your classes.')
  expect(accountGateCopy(['UNKNOWN'])).toBe('Some features wait until this account is verified. You can keep notes, study and use your classes.')
})

it('explains public from the setting and sharing from note.share', () => {
  expect(shareGateCopy({ publicWaits: false, shareWaits: false })).toBeNull()
  expect(shareGateCopy({ publicWaits: false, shareWaits: true })).toBe('This account is not verified yet, so sharing it with someone waits. You can keep writing the note.')
  expect(shareGateCopy({ publicWaits: true, shareWaits: true })).toBe('This account is not verified yet, so making it public and sharing it with someone waits. You can keep writing the note.')
})

it('uses viewerNeedsVerification when the API sends it, and the role when it does not', () => {
  expect(needsVerifyPrompt({ viewerNeedsVerification: false, globalRole: 'STUDENT' })).toBe(false)
  expect(needsVerifyPrompt({ viewerNeedsVerification: true, globalRole: 'PLATFORM_ADMIN' })).toBe(true)
  expect(needsVerifyPrompt({ viewerNeedsVerification: null, globalRole: 'PLATFORM_ADMIN' })).toBe(false)
  expect(needsVerifyPrompt({ viewerNeedsVerification: null, globalRole: 'STUDENT' })).toBe(true)
  expect(needsVerifyPrompt({ globalRole: 'TEACHER' })).toBe(true)
  expect(needsVerifyPrompt(null)).toBe(false)
})

it('stacks verify actions on a narrow phone and keeps one row on a large one', () => {
  expect(stackVerifyActions(320)).toBe(true)
  expect(stackVerifyActions(399)).toBe(true)
  expect(stackVerifyActions(400)).toBe(false)
  expect(stackVerifyActions(430)).toBe(false)
})
