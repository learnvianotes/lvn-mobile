import { useApolloClient } from '@apollo/client/react'
import * as Notifications from 'expo-notifications'
import { router, type Href } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { useEffect } from 'react'
import { Platform } from 'react-native'
import type { ApolloClient } from '@apollo/client'
import { RegisterDeviceDocument, UnregisterDeviceDocument } from '@/graphql/generated/graphql'

const TOKEN_KEY = 'lvn.pushToken'

// A notification that arrives while the app is open shows as a banner; the in-app bell updates live anyway.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
})

/** The notification's in-app path, if it carries one (ADR-0021: ids, category and path only). */
function pathOf(response: Notifications.NotificationResponse | null): string | null {
  const path = response?.notification.request.content.data?.path
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') ? path : null
}

/**
 * Push on the phone (lvn-backend ADR-0021, ADR-0050), mounted once signed in: asks for permission, registers the
 * native FCM/APNs token (no Expo push service), and opens a tapped notification's path. A build without Firebase files
 * has no token; push is then simply off and nothing else changes.
 */
export function PushSetup() {
  const client = useApolloClient()
  useEffect(() => {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return
    void registerForPush(client)
    const open = (r: Notifications.NotificationResponse | null) => {
      const path = pathOf(r)
      if (path) router.push(path as Href)
    }
    void Notifications.getLastNotificationResponseAsync().then(open)
    const tapped = Notifications.addNotificationResponseReceivedListener(open)
    const rotated = Notifications.addPushTokenListener(() => void registerForPush(client))
    return () => {
      tapped.remove()
      rotated.remove()
    }
  }, [client])
  return null
}

export async function registerForPush(client: ApolloClient): Promise<boolean> {
  try {
    const permission = await Notifications.getPermissionsAsync()
    const granted = permission.granted || (permission.canAskAgain && (await Notifications.requestPermissionsAsync()).granted)
    if (!granted) return false
    const device = await Notifications.getDevicePushTokenAsync()
    const token = device.data
    if (typeof token !== 'string' || !token) return false
    // The token says whose it is: FCM's on Android, APNs' on iOS.
    await client.mutate({ mutation: RegisterDeviceDocument, variables: { token, platform: device.type === 'ios' ? 'IOS' : 'ANDROID' } })
    await SecureStore.setItemAsync(TOKEN_KEY, token)
    return true
  } catch {
    // No Firebase config in this build, or offline: push stays off; in-app notifications work regardless.
    return false
  }
}

/** On sign-out: this phone stops getting the account's notifications. */
export async function forgetPushToken(client: ApolloClient): Promise<void> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null)
  if (!token) return
  await client.mutate({ mutation: UnregisterDeviceDocument, variables: { token } }).catch(() => undefined)
  await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined)
}
