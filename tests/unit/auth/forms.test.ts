import { AGE_MAX, AGE_MIN, ageProblem, applyProblems, wholeYears } from '@/lib/auth/forms'
import { redirectSystemPath } from '@/app/+native-intent'

describe('the age field (lvn-backend ADR-0104)', () => {
  it('takes a whole number of years from 1 to 120, as the API does', () => {
    expect([AGE_MIN, AGE_MAX]).toEqual([1, 120])
    expect(wholeYears('22')).toBe(22)
    expect(wholeYears(' 17 ')).toBe(17)
    expect(wholeYears('1')).toBe(1)
    expect(wholeYears('120')).toBe(120)
    expect(wholeYears('018')).toBe(18)
    expect(ageProblem('22')).toBeNull()
  })

  it.each([
    ['', 'required'],
    ['   ', 'required'],
    ['17.5', 'whole'],
    ['17,5', 'whole'],
    ['1e2', 'whole'],
    ['18 years', 'whole'],
    ['eighteen', 'whole'],
    ['0', 'range'],
    ['-3', 'range'],
    ['121', 'range'],
    ['999', 'range'],
  ])('refuses %j as %s', (text, problem) => {
    expect(ageProblem(text)).toBe(problem)
    expect(wholeYears(text)).toBeNull()
  })
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
