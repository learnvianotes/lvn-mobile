import { phonePath } from '@/features/notifications/route'

describe('where a notification opens on the phone (lvn-backend ADR-0076)', () => {
  it('sends data exports and imports to Settings, where the phone keeps them; everything else to its path', () => {
    expect(phonePath('/profile', 'DATA_EXPORT')).toBe('/settings')
    expect(phonePath('/profile', 'NOTES_IMPORT')).toBe('/settings')
    expect(phonePath('/profile', 'VERIFICATION')).toBe('/profile')
    expect(phonePath('/rhythm', 'RHYTHM_BUDDY')).toBe('/rhythm')
    expect(phonePath('/profile')).toBe('/profile')
  })

  it('refuses a path that is not an in-app route', () => {
    expect(phonePath('//evil.example/steal')).toBeNull()
    expect(phonePath('/notes/%2e%2e/secret')).toBeNull()
    expect(phonePath('javascript:alert(1)')).toBeNull()
    expect(phonePath('/explore?q=a..b')).toBe('/explore?q=a..b')
  })
})
