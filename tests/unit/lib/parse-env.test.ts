import { parseEnv } from '@/lib/parse-env'

const base = { EXPO_PUBLIC_APP_ENV: 'production', EXPO_PUBLIC_WEB_URL: 'https://app.learnvianotes.in', EXPO_PUBLIC_API_URL: 'https://api.learnvianotes.in/graphql' }

describe('parseEnv', () => {
  it('accepts the three environments', () => {
    for (const e of ['development', 'sandbox', 'production']) expect(parseEnv({ ...base, EXPO_PUBLIC_APP_ENV: e }).EXPO_PUBLIC_APP_ENV).toBe(e)
  })

  it('fails fast and names the bad variable', () => {
    expect(() => parseEnv({ ...base, EXPO_PUBLIC_APP_ENV: 'staging' })).toThrow('EXPO_PUBLIC_APP_ENV')
    expect(() => parseEnv({})).toThrow('EXPO_PUBLIC_APP_ENV')
    expect(() => parseEnv({ ...base, EXPO_PUBLIC_WEB_URL: 'not a url' })).toThrow('EXPO_PUBLIC_WEB_URL')
    expect(() => parseEnv({ ...base, EXPO_PUBLIC_API_URL: undefined })).toThrow('EXPO_PUBLIC_API_URL')
  })

  it('allows cleartext only in development, and never a javascript or intent address', () => {
    expect(parseEnv({ ...base, EXPO_PUBLIC_APP_ENV: 'development', EXPO_PUBLIC_WEB_URL: 'http://192.168.1.20:3000', EXPO_PUBLIC_API_URL: 'http://192.168.1.20:4000/graphql' }).EXPO_PUBLIC_API_URL).toBe('http://192.168.1.20:4000/graphql')
    expect(() => parseEnv({ ...base, EXPO_PUBLIC_API_URL: 'http://api.learnvianotes.in/graphql' })).toThrow('EXPO_PUBLIC_API_URL')
    expect(() => parseEnv({ ...base, EXPO_PUBLIC_APP_ENV: 'sandbox', EXPO_PUBLIC_LIVE_URL: 'ws://api.sandbox.learnvianotes.in/graphql/live' })).toThrow('EXPO_PUBLIC_LIVE_URL')
    expect(() => parseEnv({ ...base, EXPO_PUBLIC_API_URL: 'javascript:alert(1)' })).toThrow('EXPO_PUBLIC_API_URL')
    expect(() => parseEnv({ ...base, EXPO_PUBLIC_GITHUB_AUTHORIZE_URL: 'http://github.com/login/oauth/authorize' })).toThrow('EXPO_PUBLIC_GITHUB_AUTHORIZE_URL')
    expect(() => parseEnv({ ...base, EXPO_PUBLIC_WEB_URL: 'https://user:pass@www.learnvianotes.in' })).toThrow('EXPO_PUBLIC_WEB_URL')
  })

  it('treats an empty provider value as not configured', () => {
    const env = parseEnv({ ...base, EXPO_PUBLIC_GITHUB_CLIENT_ID: '', EXPO_PUBLIC_GITHUB_AUTHORIZE_URL: 'https://github.com/login/oauth/authorize' })
    expect(env.EXPO_PUBLIC_GITHUB_CLIENT_ID).toBeUndefined()
    expect(env.EXPO_PUBLIC_GITHUB_AUTHORIZE_URL).toBe('https://github.com/login/oauth/authorize')
  })
})
