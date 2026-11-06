import { phonePath } from '@/features/notifications/route'

describe('where a notification opens on the phone (lvn-backend ADR-0076)', () => {
  it('sends data exports and imports to Settings, where the phone keeps them; everything else to its path', () => {
    expect(phonePath('/profile', 'DATA_EXPORT')).toBe('/settings')
    expect(phonePath('/profile', 'NOTES_IMPORT')).toBe('/settings')
    expect(phonePath('/profile', 'VERIFICATION')).toBe('/profile')
    expect(phonePath('/rhythm', 'RHYTHM_BUDDY')).toBe('/rhythm')
    expect(phonePath('/profile')).toBe('/profile')
  })

  it('drops a path router.push would open outside the app', () => {
    expect(phonePath('intent://scan/#Intent;scheme=https;end')).toBeNull()
    expect(phonePath('https://evil.example/phish')).toBeNull()
    expect(phonePath('//evil.example')).toBeNull()
    expect(phonePath('/../settings')).toBeNull()
    expect(phonePath('file:///data/data/com.learnvianotes/databases/lvn-notes.db')).toBeNull()
  })
})
