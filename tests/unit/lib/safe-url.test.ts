import { allowPdfWebViewRequest, externalUrl, httpUrl, inAppPath, localMediaUri, redirectSystemPath } from '@/lib/safe-url'

describe('externalUrl', () => {
  it('keeps an http(s) or mailto address, including a pre-signed query', () => {
    const signed = 'https://bucket.example/file.pdf?X-Amz-Signature=abc%2Bdef'
    expect(externalUrl(signed)).toBe(signed)
    expect(externalUrl('mailto:ada@example.com')).toBe('mailto:ada@example.com')
    expect(httpUrl(signed)).toBe(signed)
    expect(httpUrl('mailto:ada@example.com')).toBeNull()
    expect(httpUrl('MAILTO:ada@example.com')).toBeNull()
  })

  it('refuses schemes and addresses that can leave the browser', () => {
    expect(externalUrl('intent://scan/#Intent;scheme=https;package=com.evil;end')).toBeNull()
    expect(externalUrl('javascript:alert(1)')).toBeNull()
    expect(externalUrl('file:///data/secret')).toBeNull()
    expect(externalUrl('https://user:pass@host')).toBeNull()
    expect(externalUrl('https://evil.com@good.com')).toBeNull()
    expect(externalUrl('http://evil.com\\@good.com/')).toBeNull()
    expect(httpUrl(1)).toBeNull()
  })
})

describe('localMediaUri', () => {
  it('accepts a file this phone picked and refuses a path that climbs out', () => {
    expect(localMediaUri('file:///voice.m4a')).toBe('file:///voice.m4a')
    expect(localMediaUri('content://media/external/images/1')).toBe('content://media/external/images/1')
    expect(localMediaUri('file:///data/../secret')).toBeNull()
    expect(localMediaUri('https://cdn.example/a.jpg')).toBeNull()
  })
})

describe('inAppPath', () => {
  it('accepts one in-app route', () => {
    expect(inAppPath('/explore')).toBe('/explore')
    expect(inAppPath('/classes/join/CODE?via=code')).toBe('/classes/join/CODE?via=code')
    expect(inAppPath('/explore?q=a..b')).toBe('/explore?q=a..b')
  })

  it('refuses another origin, a scheme, or a climb', () => {
    expect(inAppPath('//evil.example')).toBeNull()
    expect(inAppPath('/\\evil')).toBeNull()
    expect(inAppPath('/notes/%2e%2e/secret')).toBeNull()
    expect(inAppPath('/notes/%252e%252e/secret')).toBeNull()
    expect(inAppPath('https://evil.example')).toBeNull()
    expect(inAppPath('javascript:alert(1)')).toBeNull()
  })
})

describe('redirectSystemPath', () => {
  it('leaves the provider sign-in redirect to the auth browser', () => {
    expect(redirectSystemPath({ path: 'learnvianotes-dev://oauth/callback?code=abc&state=xyz', initial: false })).toBeNull()
    expect(redirectSystemPath({ path: '/oauth/callback?code=abc', initial: true })).toBeNull()
  })

  it('keeps an in-app route and a normal link, and sends the rest home', () => {
    expect(redirectSystemPath({ path: '/explore', initial: false })).toBe('/explore')
    expect(redirectSystemPath({ path: 'learnvianotes://notes/abc', initial: false })).toBe('learnvianotes://notes/abc')
    expect(redirectSystemPath({ path: 'learnvianotes://../../etc', initial: false })).toBe('/')
    expect(redirectSystemPath({ path: 'learnvianotes://%2e%2e/%2e%2e/etc', initial: false })).toBe('/')
    expect(redirectSystemPath({ path: 'intent://scan/#Intent;scheme=https;package=com.evil;end', initial: false })).toBe('/')
    expect(redirectSystemPath({ path: 'javascript:alert(1)', initial: false })).toBe('/')
    expect(redirectSystemPath({ path: 'not a url', initial: true })).toBe('/')
  })
})

describe('allowPdfWebViewRequest', () => {
  it('lets the bundle load and refuses a navigation', () => {
    expect(allowPdfWebViewRequest('about:blank')).toBe(true)
    expect(allowPdfWebViewRequest('file:///android_asset/index.html')).toBe(true)
    expect(allowPdfWebViewRequest('file:///data/../secret')).toBe(false)
    expect(allowPdfWebViewRequest('https://localhost:8081/_expo/static/js/bundle')).toBe(true)
    expect(allowPdfWebViewRequest('https://evil.example/page')).toBe(false)
    expect(allowPdfWebViewRequest('intent://scan/#Intent;end')).toBe(false)
    expect(allowPdfWebViewRequest('https://localhost:8081/_expo/static/js/bundle', 'click')).toBe(false)
    expect(allowPdfWebViewRequest('about:blank', 'formsubmit')).toBe(false)
  })
})
