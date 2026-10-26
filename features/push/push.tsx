import { useApolloClient } from '@apollo/client/react'
import * as Notifications from 'expo-notifications'
import { router, type Href } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { useEffect } from 'react'
import { Platform } from 'react-native'
import type { ApolloClient } from '@apollo/client'
import { RegisterDeviceDocument, UnregisterDeviceDocument } from '@/graphql/generated/graphql'
import { phonePath } from '@/features/notifications/route'

const TOKEN_KEY = 'lvn.pushToken'

// A notification that arrives while the app is open shows as a banner; the in-app bell updates live anyway.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
})

/** The notification's in-app path, if it carries one (ADR-0021: ids, category and path only). */
function pathOf(response: Notifications.NotificationResponse | null): string | null {
  const data = response?.notification.request.content.data
  return typeof data?.path === 'string' ? phonePath(data.path, data.category) : null
}

/**
 * Push on the phone (lvn-backend ADR-0021, ADR-0050), mounted once signed in: registers the native FCM/APNs token (no
 * Expo push service) when the person has already allowed notifications, and opens a tapped notification's path. It never
 * asks on its own: the person turns notifications on from the notifications screen or the settings (ask in context).
 * A build without Firebase files has no token; push is then simply off and nothing else changes.
 */
export function PushSetup() {
  const client = useApolloClient()
  useEffect(() => {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return
    void registerForPush(client, { ask: false })
    const open = (r: Notifications.NotificationResponse | null) => {
      const path = pathOf(r)
      if (path) router.push(path as Href)
    }
    void Notifications.getLastNotificationResponseAsync().then(open)
    const tapped = Notifications.addNotificationResponseReceivedListener(open)
    // A new token arrives with the event: register it as is. Asking for the token again here would fire this event again.
    const rotated = Notifications.addPushTokenListener((t) => void registerToken(client, t.data, t.type))
    return () => {
      tapped.remove()
      rotated.remove()
    }
  }, [client])
  return null
}

/** Whether the phone may show notifications, and whether asking is still possible. */
export async function pushPermission(): Promise<{ granted: boolean; canAsk: boolean }> {
  try {
    const p = await Notifications.getPermissionsAsync()
    return { granted: p.granted, canAsk: p.canAskAgain }
  } catch {
    return { granted: false, canAsk: false }
  }
}

/** Registers this phone for push; with `ask`, asks for permission first when it has not been given. */
export async function registerForPush(client: ApolloClient, { ask }: { ask: boolean }): Promise<boolean> {
  try {
    const permission = await Notifications.getPermissionsAsync()
    const granted = permission.granted || (ask && permission.canAskAgain && (await Notifications.requestPermissionsAsync()).granted)
    if (!granted) return false
    const device = await Notifications.getDevicePushTokenAsync()
    return await registerToken(client, device.data, device.type)
  } catch {
    // No Firebase config in this build, or offline: push stays off; in-app notifications work regardless.
    return false
  }
}

let registering: string | null = null

/** Tells the API about this phone's token, once per token (the same token is not sent again). */
async function registerToken(client: ApolloClient, token: unknown, type: string): Promise<boolean> {
  if (typeof token !== 'string' || !token) return false
  if (registering === token || (await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null)) === token) return true
  registering = token
  try {
    // The token says whose it is: FCM's on Android, APNs' on iOS.
    await client.mutate({ mutation: RegisterDeviceDocument, variables: { token, platform: type === 'ios' ? 'IOS' : 'ANDROID' } })
    await SecureStore.setItemAsync(TOKEN_KEY, token)
    return true
  } catch {
    return false
  } finally {
    registering = null
  }
}

/** On sign-out: this phone stops getting the account's notifications. */
export async function forgetPushToken(client: ApolloClient): Promise<void> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null)
  if (!token) return
  await client.mutate({ mutation: UnregisterDeviceDocument, variables: { token } }).catch(() => undefined)
  await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined)
}
