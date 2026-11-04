import { ageInWords, ageRefusedAt, isAgeRefusal, markAgeRefused, REFUSED_FOR_MS } from '@/lib/auth/age'
import { items } from '../../support/secure-store'

describe('the refusal remembered on the device (lvn-backend ADR-0091)', () => {
  beforeEach(() => items.clear())

  it('holds for a day, then clears itself', async () => {
    expect(await ageRefusedAt(1_000)).toBeNull()
    await markAgeRefused(1_000)
    expect(await ageRefusedAt(1_000 + REFUSED_FOR_MS - 1)).toBe(1_000)
    expect(await ageRefusedAt(1_000 + REFUSED_FOR_MS)).toBeNull()
    expect(items.size).toBe(0)
  })

  it('ignores a record it cannot read, or one from the future', async () => {
    items.set('lvn.ageRefused', 'not a time')
    expect(await ageRefusedAt(1_000)).toBeNull()
    await markAgeRefused(5_000)
    expect(await ageRefusedAt(1_000)).toBeNull()
  })
})

describe('isAgeRefusal', () => {
  it('knows the live code and the one from an API before 2026-10-25', () => {
    expect(isAgeRefusal({ code: 'AGE_RESTRICTED' })).toBe(true)
    expect(isAgeRefusal({ code: 'UNDER_MINIMUM_AGE' })).toBe(true)
    // An age outside 1 to 120 is a typo to correct, not a refusal.
    expect(isAgeRefusal({ code: 'VALIDATION' })).toBe(false)
  })
})

describe('ageInWords', () => {
  it('spells the age out, so a mis-typed digit stands out', () => {
    expect(ageInWords(22)).toBe('22 years old')
    expect(ageInWords(1)).toBe('1 year old')
  })
})
