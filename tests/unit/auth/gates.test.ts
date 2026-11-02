import { accountGateCopy } from '@/features/auth/gates'
import { stackVerifyActions } from '@/features/auth/VerifyEmailBanner'

it('names only the actions the API says are gated', () => {
  expect(accountGateCopy([])).toBeNull()
  expect(accountGateCopy(['PUBLISH_NOTE', 'SHARE_NOTE'])).toBe('You can keep notes, study and use your classes. Publishing a note and choosing who can read it waits until this account is verified.')
  expect(accountGateCopy(['UNKNOWN'])).toBe('Some features wait until this account is verified. You can keep notes, study and use your classes.')
})

it('stacks verify actions on a narrow phone and keeps one row on a large one', () => {
  expect(stackVerifyActions(320)).toBe(true)
  expect(stackVerifyActions(399)).toBe(true)
  expect(stackVerifyActions(400)).toBe(false)
  expect(stackVerifyActions(430)).toBe(false)
})
