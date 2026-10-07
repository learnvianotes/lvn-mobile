import { parseEnv } from './parse-env'

describe('parseEnv', () => {
  it('accepts the three environments', () => {
    for (const e of ['development', 'sandbox', 'production']) expect(parseEnv({ EXPO_PUBLIC_APP_ENV: e, EXPO_PUBLIC_WEB_URL: 'https://www.learnvianotes.in' }).EXPO_PUBLIC_APP_ENV).toBe(e)
  })

  it('fails fast and names the bad variable', () => {
    expect(() => parseEnv({ EXPO_PUBLIC_APP_ENV: 'staging', EXPO_PUBLIC_WEB_URL: 'https://www.learnvianotes.in' })).toThrow('EXPO_PUBLIC_APP_ENV')
    expect(() => parseEnv({})).toThrow('EXPO_PUBLIC_APP_ENV')
    expect(() => parseEnv({ EXPO_PUBLIC_APP_ENV: 'production', EXPO_PUBLIC_WEB_URL: 'not a url' })).toThrow('EXPO_PUBLIC_WEB_URL')
  })
})
