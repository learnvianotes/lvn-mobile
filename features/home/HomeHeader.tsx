import { useApolloClient, useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { Bell, Menu, Search } from 'lucide-react-native'
import { useState } from 'react'
import { View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Wordmark } from '@/components/brand/Logo'
import { Text } from '@/components/ui/text'
import { useLive } from '@/features/notifications/live'
import { AppMenu } from '@/features/shell/AppMenu'
import { PressScale } from '@/features/shell/PressScale'
import { AppearanceButton } from '@/features/shell/AppearanceButton'
import { UnreadNotificationCountDocument, ViewerDocument } from '@/graphql/generated/graphql'

const SEARCH = 'Search notes, topics, people, or ask AI…'

/** The bell (lvn-backend ADR-0042): the unread count, refreshed by live events while the app is open. */
function NotificationBell({ color }: { color: string }) {
  const client = useApolloClient()
  const { data } = useQuery(UnreadNotificationCountDocument, { fetchPolicy: 'cache-and-network' })
  useLive(() => void client.refetchQueries({ include: ['UnreadNotificationCount', 'Notifications'] }))
  const unread = data?.unreadNotificationCount ?? 0
  return (
    <PressScale accessibilityRole="button" accessibilityLabel={unread ? `Notifications, ${unread} unread` : 'Notifications'} hitSlop={4} onPress={() => router.push('/notifications')}>
      <View className="bg-card border-border size-10 items-center justify-center rounded-full border">
        <Bell size={20} color={color} />
        {unread ? (
          <View className="bg-primary absolute -right-1 -top-1 h-5 min-w-5 items-center justify-center rounded-full px-1">
            <Text className="text-primary-foreground text-[10px] font-semibold">{unread > 99 ? '99+' : unread}</Text>
          </View>
        ) : null}
      </View>
    </PressScale>
  )
}

/** Menu, wordmark, theme, bell and account. Search opens Explore. */
export function HomeHeader() {
  const fg = String(useCSSVariable('--color-foreground') ?? '#1c1b18')
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#66625b')
  const name = useQuery(ViewerDocument).data?.viewer?.displayName.trim() ?? ''
  const [menu, setMenu] = useState(false)
  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-1">
        <PressScale accessibilityRole="button" accessibilityLabel="Menu" accessibilityState={{ expanded: menu }} hitSlop={4} onPress={() => setMenu(true)}>
          <View className="size-10 items-center justify-center rounded-full">
            <Menu size={22} color={fg} />
          </View>
        </PressScale>
        <View className="flex-1">
          <Wordmark size={26} />
        </View>
        <AppearanceButton />
        <NotificationBell color={fg} />
        <PressScale accessibilityRole="button" accessibilityLabel="Your account" hitSlop={4} onPress={() => router.push('/profile')}>
          <View className="bg-secondary size-10 items-center justify-center rounded-full">
            <Text className="text-secondary-foreground font-semibold">{name.slice(0, 1).toUpperCase() || '·'}</Text>
          </View>
        </PressScale>
      </View>
      <PressScale accessibilityRole="search" accessibilityLabel={SEARCH} onPress={() => router.push({ pathname: '/explore', params: { focus: String(Date.now()) } })}>
        <View className="bg-card border-border h-11 flex-row items-center gap-3 rounded-[14px] border px-4">
          <Search size={18} color={muted} />
          <Text className="text-muted-foreground text-sm">{SEARCH}</Text>
        </View>
      </PressScale>
      <AppMenu open={menu} onClose={() => setMenu(false)} />
    </View>
  )
}
