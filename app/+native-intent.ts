import { getShareExtensionKey } from 'expo-share-intent'
import { redirectSystemPath as redirectChecked } from '@/lib/safe-url'

/**
 * Links the system opens the app with. A share (`<scheme>://dataUrl=<scheme>ShareKey`) goes to Save to LVN.
 * The provider sign-in redirect is not a screen. Every other link is checked before Expo Router navigates:
 * `router.push` opens `intent:`, `file:` and `//host` with the OS.
 */
export function redirectSystemPath(event: { path: string; initial: boolean }): string | null {
  try {
    const key = getShareExtensionKey()
    if (key && event.path.includes(`dataUrl=${key}`)) return '/share'
  } catch {
    // No scheme yet. The checks below still decide where the link goes.
  }
  return redirectChecked(event)
}
