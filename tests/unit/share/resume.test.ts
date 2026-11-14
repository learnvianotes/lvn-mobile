import { redirectSystemPath } from '@/app/+native-intent'
import { shareResume } from '@/features/share/pending'

describe('resuming a share', () => {
  it('waits while the session is restoring, stays put until sign-in, then opens', () => {
    expect(shareResume({ phase: 'signed-in', registered: true, hasPending: false })).toBe('hold')
    expect(shareResume({ phase: 'restoring', registered: false, hasPending: true })).toBe('hold')
    expect(shareResume({ phase: 'signed-out', registered: false, hasPending: true })).toBe('wait-for-sign-in')
    expect(shareResume({ phase: 'signed-in', registered: false, hasPending: true })).toBe('wait-for-sign-in')
    expect(shareResume({ phase: 'signed-in', registered: true, hasPending: true })).toBe('open')
  })

  it('sends the share-extension open to Save to LVN and leaves every other path alone', () => {
    expect(redirectSystemPath({ path: 'learnvianotes-dev://dataUrl=testShareKey', initial: true })).toBe('/share')
    expect(redirectSystemPath({ path: '/notes/abc', initial: false })).toBe('/notes/abc')
    expect(redirectSystemPath({ path: 'learnvianotes-dev://oauth/callback?code=abc', initial: false })).toBeNull()
  })
})
