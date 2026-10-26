import { addNetworkStateListener, getNetworkStateAsync, type NetworkState } from 'expo-network'
import { WifiOff } from 'lucide-react-native'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { View } from 'react-native'
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'

/** Whether the phone has no internet now (expo-network: not connected, or the network says it cannot reach it). */
export function useOffline(): boolean {
  const [offline, setOffline] = useState(false)
  useEffect(() => {
    let live = true
    const read = (s: Pick<NetworkState, 'isConnected' | 'isInternetReachable'>) => {
      if (live) setOffline(s.isConnected === false || s.isInternetReachable === false)
    }
    void getNetworkStateAsync()
      .then(read)
      .catch(() => undefined)
    const sub = addNetworkStateListener(read)
    return () => {
      live = false
      sub.remove()
    }
  }, [])
  return offline
}

/**
 * A thin strip under the status bar while the phone is offline (P9e), above every screen in `children`. It pushes the
 * screens down rather than covering them: while it shows, their top inset is 0, so a header sits right under the
 * strip instead of a status bar's height lower. Screens show what Apollo's cache and the phone's store kept.
 */
export function OfflineBanner({ enabled = true, children }: { enabled?: boolean; children?: ReactNode }) {
  const offline = useOffline() && enabled
  const insets = useSafeAreaInsets()
  const fg = String(useCSSVariable('--color-secondary-foreground') ?? '#1e4d8c')
  const below = useMemo(() => (offline ? { ...insets, top: 0 } : insets), [offline, insets])
  return (
    <>
      {offline ? (
        <View accessibilityLiveRegion="polite" className="bg-secondary flex-row items-center justify-center gap-2 px-4 pb-1.5" style={{ paddingTop: insets.top + 4 }}>
          <WifiOff size={14} color={fg} />
          <Text className="text-secondary-foreground shrink text-xs font-medium">{"You're offline. Showing what was saved on this phone."}</Text>
        </View>
      ) : null}
      <SafeAreaInsetsContext.Provider value={below}>{children}</SafeAreaInsetsContext.Provider>
    </>
  )
}
