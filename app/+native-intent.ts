/**
 * Links the system opens the app with. The provider sign-in redirect (`<scheme>://oauth/callback?code=…`) is read by
 * expo-auth-session from the auth browser; it is not a screen, so the router stays where it is.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string | null {
  try {
    if (/^([a-z-]+:\/\/)?\/?oauth\/callback/.test(path)) return null
    return path
  } catch {
    return path
  }
}
