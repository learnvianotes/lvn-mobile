/**
 * Addresses and routes the app may act on. `javascript:`, `intent:` and `file:` are refused before anything is handed
 * to the OS: on Android those schemes start activities or read local files. Expo Router's `router.push` does the same
 * for `intent:`, `file:`, `content:` and protocol-relative URLs (`//host` becomes `https://host`). The original string
 * is kept when it is safe, so a pre-signed query is not re-encoded.
 */

const WEB = new Set(['http:', 'https:', 'mailto:'])
const BLOCKED_SCHEME = new Set(['javascript:', 'intent:', 'file:', 'data:', 'content:', 'blob:', 'vbscript:', 'filesystem:'])
/** Custom schemes this app actually registers, plus Expo Go. Anything else is not a route. */
const APP_SCHEMES = new Set(['learnvianotes:', 'learnvianotes-dev:', 'learnvianotes-sandbox:', 'exp:', 'exps:'])
/** Hosts whose https links may open an in-app path. Other https links are not routes. */
const WEB_HOSTS = new Set(['learnvianotes.in', 'www.learnvianotes.in', 'sandbox.learnvianotes.in'])

const OAUTH = /^(?:[a-z][a-z0-9+.-]*:\/\/)?\/?oauth\/callback(?:[/?#]|$)/i

function unfold(value: string): string | null {
  let current = value
  for (let i = 0; i < 3; i++) {
    if (/[\u0000-\u001f\\]/.test(current)) return null
    let next: string
    try {
      next = decodeURIComponent(current)
    } catch {
      return null
    }
    if (next === current) return current
    current = next
  }
  return /[\u0000-\u001f\\]/.test(current) ? null : current
}

function escapes(value: string): boolean {
  const decoded = unfold(value)
  if (decoded == null) return true
  const pathOnly = decoded.split(/[?#]/)[0] ?? decoded
  return pathOnly.split('/').some((segment) => segment === '..' || segment === '.')
}

/** An http(s) or mailto address with no userinfo and no control characters. */
export function externalUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || /[\u0000-\u001f\\]/.test(trimmed)) return null
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  if (!WEB.has(url.protocol) || url.username || url.password) return null
  return trimmed
}

/** An http(s) address. Mail links are not documents or pictures. */
export function httpUrl(value: unknown): string | null {
  const url = externalUrl(value)
  if (!url) return null
  const protocol = new URL(url).protocol
  if (protocol !== 'http:' && protocol !== 'https:') return null
  return url
}

/** A picture or file this phone just picked. Not a server address and not a path that climbs out of the cache. */
export function localMediaUri(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const uri = value.trim()
  if (!uri || /[\u0000-\u001f\\]/.test(uri) || escapes(uri)) return null
  if (uri.startsWith('file://') || uri.startsWith('content://')) return uri
  return null
}

/** A remote picture, or a file the picker just returned. */
export function mediaUri(value: unknown): string | null {
  return httpUrl(value) ?? localMediaUri(value)
}

/** An in-app route: one leading slash, no scheme, no protocol-relative form, no `.` or `..` segment. */
export function inAppPath(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const path = value.trim()
  if (!path.startsWith('/') || path.startsWith('//')) return null
  if (escapes(path)) return null
  const decoded = unfold(path)
  if (!decoded || !decoded.startsWith('/') || decoded.startsWith('//')) return null
  if (/^[a-z][a-z0-9+.-]*:/i.test(decoded.slice(1))) return null
  return path
}

/**
 * What `redirectSystemPath` may hand back to Expo Router. OAuth stays out of the router (`null`). A dangerous scheme,
 * another app's URL, or a path that climbs with `..` becomes `/`. The raw string is never returned from a failure.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string | null {
  try {
    const raw = typeof path === 'string' ? path.trim() : ''
    if (!raw || /[\u0000-\u001f\\]/.test(raw)) return '/'
    if (OAUTH.test(raw)) return null
    if (raw.startsWith('/') && !raw.startsWith('//')) return inAppPath(raw) ?? '/'
    if (raw.startsWith('//')) return '/'
    const url = new URL(raw)
    if (BLOCKED_SCHEME.has(url.protocol) || url.username || url.password) return '/'
    if (url.protocol === 'https:' && WEB_HOSTS.has(url.hostname)) {
      return inAppPath(`${url.pathname}${url.search}${url.hash}`) ?? '/'
    }
    if (!APP_SCHEMES.has(url.protocol)) return '/'
    const route = `${url.hostname}${url.pathname}${url.search}${url.hash}`
    if (escapes(route) || url.hostname === '..' || url.hostname === '.') return '/'
    return raw
  } catch {
    return '/'
  }
}

/** Metro, a LAN address, or an Expo tunnel. Not a public website that happens to have `/_expo/` in the path. */
function devHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true
  if (host.endsWith('.exp.direct') || host.endsWith('.expo.dev') || host.endsWith('.local')) return true
  const parts = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (!parts) return false
  const [a, b, c, d] = parts.slice(1).map(Number) as [number, number, number, number]
  if ([a, b, c, d].some((n) => n > 255)) return false
  if (a === 10 || a === 127) return true
  if (a === 192 && b === 168) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  // Tailscale and other CGNAT addresses used for the dev machine.
  if (a === 100 && b >= 64 && b <= 127) return true
  return false
}

/**
 * Whether an Expo DOM web view may load `url`. The bundle itself (dev `/_expo/` on a dev host, Android assets, the
 * iOS `www.bundle`) may load. A click, a form, or any other address may not: that view allows file access, and a
 * loaded page can call the native props through the web view message bridge.
 */
export function allowDomNavigation(url: string, navigationType?: string): boolean {
  if (!url || navigationType === 'click' || navigationType === 'formsubmit') return false
  if (url === 'about:blank') return true
  if (/[\u0000\\]/.test(url) || escapes(url)) return false
  if (url.startsWith('file:///android_asset/') || url.startsWith('file:///android_res/')) return true
  if (url.startsWith('www.bundle/') || url.includes('/www.bundle/') || url.includes('.expo-internal/')) return true
  try {
    const parsed = new URL(url)
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.pathname.startsWith('/_expo/') && devHost(parsed.hostname)
  } catch {
    return false
  }
}
