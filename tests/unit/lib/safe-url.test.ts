import { redirectSystemPath as fromIntent } from '@/app/+native-intent'
import { allowDomNavigation, externalUrl, httpUrl, inAppPath, localMediaUri, redirectSystemPath } from '@/lib/safe-url'

describe('external addresses', () => {
  it('keeps http(s) and mailto, and the original pre-signed query', () => {
    const signed = 'https://storage.example/a.pdf?X-Amz-Signature=abc+def%2F'
    expect(externalUrl(signed)).toBe(signed)
    expect(httpUrl(signed)).toBe(signed)
    expect(externalUrl('mailto:hello@learnvianotes.in')).toBe('mailto:hello@learnvianotes.in')
    expect(httpUrl('mailto:hello@learnvianotes.in')).toBeNull()
  })

  it('refuses schemes that start activities or read files, and addresses with userinfo', () => {
    for (const value of ['javascript:alert(1)', 'intent://scan/#Intent;scheme=https;end', 'file:///data/data/com.learnvianotes/databases/lvn-notes.db', 'content://contacts/people', 'data:text/html,hi', 'http://user:secret@api.learnvianotes.in/graphql', 'https://evil.com\\@learnvianotes.in', 'https://example.com/\nset-cookie']) {
      expect(externalUrl(value)).toBeNull()
      expect(httpUrl(value)).toBeNull()
    }
  })
})

describe('local media', () => {
  it('allows a picker uri and refuses one that climbs out or is a remote address', () => {
    expect(localMediaUri('file:///cache/photo.jpg')).toBe('file:///cache/photo.jpg')
    expect(localMediaUri('content://media/external/images/media/1')).toBe('content://media/external/images/media/1')
    expect(localMediaUri('file:///cache/../databases/lvn-notes.db')).toBeNull()
    expect(localMediaUri('https://storage.example/a.jpg')).toBeNull()
  })
})

describe('in-app paths', () => {
  it('keeps a single-slash route and drops schemes, protocol-relative URLs and ..', () => {
    expect(inAppPath('/notes/abc?page=2')).toBe('/notes/abc?page=2')
    expect(inAppPath('/explore')).toBe('/explore')
    expect(inAppPath('//evil.example')).toBeNull()
    expect(inAppPath('/../admin')).toBeNull()
    expect(inAppPath('/%2e%2e/%2e%2e/admin')).toBeNull()
    expect(inAppPath('/intent://scan')).toBeNull()
    expect(inAppPath('intent://scan/#Intent;end')).toBeNull()
    expect(inAppPath('https://evil.example')).toBeNull()
  })
})

describe('system deep links', () => {
  it('keeps the provider redirect away from the router and passes an in-app path through', () => {
    expect(fromIntent({ path: '/explore', initial: false })).toBe('/explore')
    expect(fromIntent({ path: 'learnvianotes-dev://dataUrl=testShareKey', initial: true })).toBe('/share')
    expect(redirectSystemPath({ path: 'learnvianotes-dev://oauth/callback?code=abc&state=xyz', initial: false })).toBeNull()
    expect(redirectSystemPath({ path: '/oauth/callback?code=abc', initial: true })).toBeNull()
    expect(redirectSystemPath({ path: '/explore', initial: false })).toBe('/explore')
    expect(redirectSystemPath({ path: 'learnvianotes://notes/abc?page=2', initial: false })).toBe('learnvianotes://notes/abc?page=2')
  })

  it('sends intent, javascript, file and foreign https links to /, and never returns the raw string from a bad parse', () => {
    expect(redirectSystemPath({ path: 'intent://scan/#Intent;scheme=https;package=com.evil;end', initial: false })).toBe('/')
    expect(redirectSystemPath({ path: 'javascript:alert(1)', initial: true })).toBe('/')
    expect(redirectSystemPath({ path: 'file:///data/data/com.learnvianotes/databases/lvn-notes.db', initial: false })).toBe('/')
    expect(redirectSystemPath({ path: 'https://evil.example/phish', initial: false })).toBe('/')
    expect(redirectSystemPath({ path: '//evil.example', initial: false })).toBe('/')
    expect(redirectSystemPath({ path: 'learnvianotes://../../etc', initial: false })).toBe('/')
    expect(redirectSystemPath({ path: '::::', initial: false })).toBe('/')
    expect(redirectSystemPath({ path: 'https://www.learnvianotes.in/notes/abc', initial: true })).toBe('/notes/abc')
  })
})

describe('DOM web view loads', () => {
  it('allows the bundle and refuses a click, a form, or another file', () => {
    expect(allowDomNavigation('file:///android_asset/www.bundle/features/reader/PdfDom', 'other')).toBe(true)
    expect(allowDomNavigation('http://10.0.2.2:8081/_expo/@dom/features/reader/PdfDom', undefined)).toBe(true)
    expect(allowDomNavigation('about:blank', 'other')).toBe(true)
    expect(allowDomNavigation('file:///android_asset/www.bundle/index.html', 'click')).toBe(false)
    expect(allowDomNavigation('https://evil.example/_expo/', 'other')).toBe(false)
    expect(allowDomNavigation('http://100.70.234.41:8081/_expo/@dom/features/reader/PdfDom', 'other')).toBe(true)
    expect(allowDomNavigation('https://evil.example/phish', 'other')).toBe(false)
    expect(allowDomNavigation('file:///data/data/com.learnvianotes/databases/lvn-notes.db', 'other')).toBe(false)
    expect(allowDomNavigation('intent://scan/#Intent;end', 'other')).toBe(false)
    expect(allowDomNavigation('file:///android_asset/www.bundle/../../databases/lvn-notes.db', 'other')).toBe(false)
  })
})
