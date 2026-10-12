import { useApolloClient } from '@apollo/client/react'
import { BellRing } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { pushPermission, registerForPush } from './push'

/**
 * An offer to get notifications on this phone (ADR-0050), shown until they are on or the phone no longer lets the app
 * ask. Asking happens here, in context, never at sign-in.
 */
export function TurnOnPush({ onEnabled }: { onEnabled?: () => void }) {
  const client = useApolloClient()
  const accent = String(useCSSVariable('--color-primary') ?? '#4f46e5')
  const [state, setState] = useState<{ granted: boolean; canAsk: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    void pushPermission().then(setState)
  }, [])
  if (!state || state.granted || !state.canAsk) return null
  return (
    <View className="bg-card border-border flex-row items-center gap-3 rounded-2xl border p-3">
      <BellRing size={18} color={accent} />
      <Text className="flex-1 text-sm">Get these on this phone too</Text>
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={async () => {
          setBusy(true)
          const on = await registerForPush(client, { ask: true })
          setState(await pushPermission())
          setBusy(false)
          if (on) onEnabled?.()
        }}
        className="bg-primary rounded-full px-3 py-1.5"
      >
        <Text className="text-primary-foreground text-sm font-semibold">Turn on</Text>
      </Pressable>
    </View>
  )
}
