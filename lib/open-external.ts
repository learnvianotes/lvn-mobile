import * as WebBrowser from 'expo-web-browser'
import { Linking } from 'react-native'
import { externalUrl, httpUrl } from './safe-url'

/** Opens a web or mail address outside the app. Other schemes are ignored. */
export function openExternal(value: unknown): void {
  const url = externalUrl(value)
  if (url) void Linking.openURL(url)
}

/** Opens an http(s) address in the system browser. Other schemes are ignored. */
export function openInBrowser(value: unknown): void {
  const url = httpUrl(value)
  if (url) void WebBrowser.openBrowserAsync(url)
}
