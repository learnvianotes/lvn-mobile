import { ageRefusedAt, birthDateInWords, markAgeRefused, REFUSED_FOR_MS } from '@/lib/auth/age'
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

describe('birthDateInWords', () => {
  it('spells the date out, so a wrong year stands out', () => {
    expect(birthDateInWords('2001-03-14')).toBe('14 March 2001')
    expect(birthDateInWords('2004-05-01')).toBe('1 May 2004')
  })

  it('is empty without a date', () => {
    expect(birthDateInWords(null)).toBe('')
    expect(birthDateInWords('14/03/2001')).toBe('')
  })
})
