import { useApolloClient, useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { Bell, Search } from 'lucide-react-native'
import { View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Wordmark } from '@/components/brand/Logo'
import { Text } from '@/components/ui/text'
import { useLive } from '@/features/notifications/live'
import { PressScale } from '@/features/shell/PressScale'
import { UnreadNotificationCountDocument } from '@/graphql/generated/graphql'

/** The bell (lvn-backend ADR-0042): the unread count, refreshed by live events while the app is open. */
function NotificationBell({ color }: { color: string }) {
  const client = useApolloClient()
  const { data } = useQuery(UnreadNotificationCountDocument, { fetchPolicy: 'cache-and-network' })
  useLive(() => void client.refetchQueries({ include: ['UnreadNotificationCount', 'Notifications'] }))
  const unread = data?.unreadNotificationCount ?? 0
  return (
    <PressScale accessibilityRole="button" accessibilityLabel={unread ? `Notifications, ${unread} unread` : 'Notifications'} hitSlop={8} onPress={() => router.push('/notifications')}>
      <View className="bg-card border-border size-10 items-center justify-center rounded-full border">
        <Bell size={20} color={color} />
        {unread ? (
          <View className="bg-rose absolute -right-1 -top-1 h-5 min-w-5 items-center justify-center rounded-full px-1">
            <Text className="text-[10px] font-bold text-white">{unread > 99 ? '99+' : unread}</Text>
          </View>
        ) : null}
      </View>
    </PressScale>
  )
}

export function HomeHeader() {
  const fg = String(useCSSVariable('--color-foreground') ?? '#1e1b2e')
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#5f5f73')
  return (
    <View className="gap-4">
      <View className="flex-row items-center justify-between">
        <Wordmark size={34} />
        <View className="flex-row items-center gap-2">
          <NotificationBell color={fg} />
          <View className="bg-secondary size-10 items-center justify-center rounded-full">
            <Text className="text-secondary-foreground font-bold">M</Text>
          </View>
        </View>
      </View>
      <PressScale feedback="none" accessibilityRole="search" accessibilityLabel="Search notes, topics and people">
        <View className="bg-card border-border h-12 flex-row items-center gap-3 rounded-2xl border px-4">
          <Search size={18} color={muted} />
          <Text className="text-muted-foreground text-sm">Search notes, topics, people…</Text>
        </View>
      </PressScale>
    </View>
  )
}
