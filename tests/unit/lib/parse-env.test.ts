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

  it('treats an empty provider value as not configured', () => {
    const env = parseEnv({ ...base, EXPO_PUBLIC_GITHUB_CLIENT_ID: '', EXPO_PUBLIC_GITHUB_AUTHORIZE_URL: 'https://github.com/login/oauth/authorize' })
    expect(env.EXPO_PUBLIC_GITHUB_CLIENT_ID).toBeUndefined()
    expect(env.EXPO_PUBLIC_GITHUB_AUTHORIZE_URL).toBe('https://github.com/login/oauth/authorize')
  })
})
