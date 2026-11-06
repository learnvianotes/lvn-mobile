import { SUPPORT_EMAIL, supportMailto } from '@/lib/support'

describe('support address', () => {
  it('is the one public address, and the mailto uses only that', () => {
    expect(SUPPORT_EMAIL).toBe('support@learnvianotes.in')
    expect(supportMailto()).toBe('mailto:support@learnvianotes.in')
  })
})
