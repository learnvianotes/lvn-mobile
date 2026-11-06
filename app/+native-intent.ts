/**
 * Links the system opens the app with. The provider sign-in redirect (`<scheme>://oauth/callback?code=…`) is read by
 * expo-auth-session from the auth browser; it is not a screen, so the router stays where it is. Every other link is
 * checked before Expo Router navigates: `router.push` opens `intent:`, `file:` and `//host` with the OS.
 */
export { redirectSystemPath } from '@/lib/safe-url'
