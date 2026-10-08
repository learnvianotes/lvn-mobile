import { applyProblems, dateOfBirth } from '@/lib/auth/forms'
import { redirectSystemPath } from '@/app/+native-intent'

describe('dateOfBirth', () => {
  const today = new Date('2026-10-08T00:00:00Z')

  it('formats day, month and year for the API', () => {
    expect(dateOfBirth('1', '5', '2004', today)).toBe('2004-05-01')
    expect(dateOfBirth(' 29 ', '02', '2004', today)).toBe('2004-02-29')
  })

  it.each([
    ['30', '2', '2004'],
    ['29', '2', '2005'],
    ['31', '4', '2004'],
    ['0', '1', '2004'],
    ['1', '13', '2004'],
    ['1', '1', '1899'],
    ['1', '1', '2027'],
    ['', '1', '2004'],
    ['1a', '1', '2004'],
  ])('refuses %s/%s/%s', (d, m, y) => expect(dateOfBirth(d, m, y, today)).toBeNull())
})

describe('applyProblems', () => {
  it('puts field errors on their fields and returns the first general one', () => {
    const setError = jest.fn()
    const general = applyProblems(
      [
        { field: ['input', 'email'], message: 'Taken', code: 'CONFLICT' },
        { field: null, message: 'Slow down', code: 'RATE_LIMITED' },
        { field: ['input', 'unknown'], message: 'Other', code: 'VALIDATION' },
      ],
      setError,
      ['email', 'password'],
    )
    expect(setError).toHaveBeenCalledWith('email', { type: 'server', message: 'Taken' })
    expect(general).toBe('Slow down')
  })
})

describe('+native-intent', () => {
  it('keeps the provider redirect away from the router and passes other links through', () => {
    expect(redirectSystemPath({ path: 'learnvianotes-dev://oauth/callback?code=abc&state=xyz', initial: false })).toBeNull()
    expect(redirectSystemPath({ path: '/oauth/callback?code=abc', initial: true })).toBeNull()
    expect(redirectSystemPath({ path: '/explore', initial: false })).toBe('/explore')
  })
})
