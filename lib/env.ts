import { parseEnv } from './parse-env'

/**
 * Validated once at start-up; the app does not start with a missing or malformed value.
 * Expo inlines EXPO_PUBLIC_* at build time, so each variable must be read by its full name.
 */
export const env = parseEnv({
  EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
  EXPO_PUBLIC_WEB_URL: process.env.EXPO_PUBLIC_WEB_URL,
})
