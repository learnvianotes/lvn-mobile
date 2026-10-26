/**
 * Addresses the app may hand to the OS or to a browser. `javascript:`, `intent:` and `file:` are refused: on Android
 * those schemes start activities or read local files. The original string is kept so a pre-signed query is not re-encoded.
 */
const WEB = new Set(['http:', 'https:', 'mailto:'])

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
  if (typeof value !== 'string') return null
  const url = externalUrl(value)
  if (!url) return null
  let protocol: string
  try {
    protocol = new URL(url).protocol
  } catch {
    return null
  }
  if (protocol !== 'http:' && protocol !== 'https:') return null
  return url
}

/** A picture or recording this phone just picked. Not a server address. */
export function localMediaUri(value: unknown): string | null {
  if (typeof value !== 'string' || /[\u0000-\u001f\\]/.test(value) || value.includes('..')) return null
  if (value.startsWith('file://') || value.startsWith('content://')) return value
  return null
}

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
  return pathOnly.split('/').some((segment) => segment === '..')
}

/** An in-app route: one leading slash, no scheme, no protocol-relative form, no `..`. */
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

const BLOCKED_SCHEME = new Set(['javascript:', 'intent:', 'file:', 'data:', 'content:', 'blob:', 'vbscript:', 'filesystem:'])

/** The provider sign-in redirect is read by expo-auth-session; it is not a screen. */
const OAUTH = /^(?:[a-z][a-z0-9+.-]*:\/\/)?\/?oauth\/callback(?:[/?#]|$)/i

/**
 * What `redirectSystemPath` may hand back to Expo Router. The argument is whatever the system delivered — a route, a
 * full URL, or neither. OAuth stays out of the router (null). Anything that is not an in-app route becomes `/`,
 * including when parsing throws: the raw string is never returned from the failure path.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string | null {
  try {
    const raw = path.trim()
    if (!raw || /[\u0000-\u001f\\]/.test(raw)) return '/'
    if (OAUTH.test(raw)) return null
    if (raw.startsWith('/') && !raw.startsWith('//')) return inAppPath(raw) ?? '/'
    if (raw.startsWith('//')) return '/'
    const url = new URL(raw)
    if (BLOCKED_SCHEME.has(url.protocol)) return '/'
    const route = `${url.hostname}${url.pathname}${url.search}${url.hash}`
    if (escapes(route) || url.hostname === '..' || url.pathname.includes('//')) return '/'
    return raw
  } catch {
    return '/'
  }
}

/**
 * Whether the PDF web view may load `url`. Expo's DOM web view ignores `originWhitelist` and allows file access, so
 * this is also enforced by not following links inside that view. Clicks and form submits never navigate it.
 */
export function allowPdfWebViewRequest(url: string, navigationType?: string): boolean {
  if (!url || navigationType === 'click' || navigationType === 'formsubmit') return false
  if (url === 'about:blank') return true
  if (/[\u0000\\]/.test(url) || escapes(url)) return false
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url)?.[1]?.toLowerCase()
  if (!scheme) return url.startsWith('www.bundle') || url.includes('/_expo/') || url.includes('.expo-internal')
  if (scheme === 'javascript' || scheme === 'intent' || scheme === 'data' || scheme === 'content' || scheme === 'blob' || scheme === 'vbscript') return false
  if (scheme === 'file') return true
  if (scheme !== 'http' && scheme !== 'https') return false
  try {
    return new URL(url).pathname.startsWith('/_expo/')
  } catch {
    return false
  }
}
