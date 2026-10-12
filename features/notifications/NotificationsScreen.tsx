import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { router, type Href } from 'expo-router'
import { ArrowLeft, BadgeCheck, Bell, CheckCheck, CircleHelp, DoorOpen, Download, FileInput, GraduationCap, Handshake, Megaphone, MessageSquare, School, Share2, ShieldAlert, UserPlus, Users } from 'lucide-react-native'
import { useState } from 'react'
import { FlatList, Pressable, RefreshControl, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { MarkNotificationsReadDocument, NotificationsDocument, type NotificationFieldsFragment } from '@/graphql/generated/graphql'
import { ago, describeNotification } from './describe'
import { useLive } from './live'
import { TurnOnPush } from '@/features/push/TurnOnPush'

const PAGE = 20
const ICONS: Partial<Record<NotificationFieldsFragment['category'], typeof Bell>> = { SHARE: Share2, VERIFICATION: BadgeCheck, DATA_EXPORT: Download, NOTES_IMPORT: FileInput, FOLLOW: UserPlus, CONNECTION: Handshake, JOIN_REQUEST: DoorOpen, JOIN_DECISION: Users, CLASSROOM_INVITE: GraduationCap, CLASSROOM_POST: Megaphone, COMMENT: MessageSquare, MENTOR_INVITE: School, DOUBT: CircleHelp, MODERATION: ShieldAlert }

/** The person's notifications, newest first (lvn-backend ADR-0042); opening one marks it read and goes where it points. */
export function NotificationsScreen() {
  const insets = useSafeAreaInsets()
  const fg = String(useCSSVariable('--color-foreground') ?? '#111827')
  const accent = String(useCSSVariable('--color-primary') ?? '#4f46e5')
  const client = useApolloClient()
  const { data, loading, refetch, fetchMore } = useQuery(NotificationsDocument, { variables: { first: PAGE }, fetchPolicy: 'cache-and-network' })
  const [mark] = useMutation(MarkNotificationsReadDocument)
  const [refreshing, setRefreshing] = useState(false)
  useLive(() => void client.refetchQueries({ include: ['UnreadNotificationCount', 'Notifications'] }))
  const items = data?.notifications.edges.map((e) => e.node) ?? []
  const unread = data?.unreadNotificationCount ?? 0

  const markRead = (input: { ids?: string[]; all?: boolean }) => {
    const now = new Date().toISOString()
    return mark({
      variables: { input },
      update: (cache, res) => {
        const left = res.data?.markNotificationsRead.unreadCount
        if (left === undefined) return
        cache.modify({ fields: { unreadNotificationCount: () => left } })
        for (const n of items) {
          if (input.all || input.ids?.includes(n.id)) cache.modify({ id: cache.identify({ __typename: 'Notification', id: n.id }), fields: { readAt: (v: string | null) => v ?? now } })
        }
      },
    })
  }

  const open = (n: NotificationFieldsFragment) => {
    if (!n.readAt) void markRead({ ids: [n.id] })
    router.push(n.path as Href)
  }

  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top + 6 }}>
      <View className="flex-row items-center gap-2 px-3 pb-2">
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} className="rounded-full p-2">
          <ArrowLeft size={22} color={fg} />
        </Pressable>
        <Text className="flex-1 text-xl font-extrabold" accessibilityRole="header">
          Notifications
        </Text>
        {unread ? (
          <Pressable accessibilityRole="button" onPress={() => void markRead({ all: true })} className="flex-row items-center gap-1.5 rounded-full px-3 py-2">
            <CheckCheck size={16} color={accent} />
            <Text className="text-primary text-sm font-semibold">Mark all as read</Text>
          </Pressable>
        ) : null}
      </View>
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        ListHeaderComponent={<TurnOnPush />}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              void refetch().finally(() => setRefreshing(false))
            }}
          />
        }
        onEndReached={() => {
          if (data?.notifications.pageInfo.hasNextPage) {
            void fetchMore({
              variables: { first: PAGE, after: data.notifications.pageInfo.endCursor },
              updateQuery: (prev, { fetchMoreResult }) => ({ ...fetchMoreResult, notifications: { ...fetchMoreResult.notifications, edges: [...prev.notifications.edges, ...fetchMoreResult.notifications.edges] } }),
            })
          }
        }}
        ListEmptyComponent={
          loading ? null : (
            <View className="items-center gap-3 py-16">
              <Bell size={32} color={fg} />
              <Text className="text-muted-foreground px-6 text-center">Nothing here yet. When someone shares a note with you, or something you asked for is ready, you will see it here.</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const Icon = ICONS[item.category] ?? Bell
          const sentence = describeNotification(item)
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.readAt ? sentence : `Unread: ${sentence}`}
              onPress={() => open(item)}
              className={`border-border flex-row items-start gap-3 rounded-2xl border p-4 ${item.readAt ? 'bg-card' : 'bg-secondary'}`}
            >
              <View className="bg-background size-9 items-center justify-center rounded-full">
                <Icon size={16} color={accent} />
              </View>
              <View className="flex-1 gap-1">
                <Text className={item.readAt ? '' : 'font-semibold'}>{sentence}</Text>
                <Text className="text-muted-foreground text-xs">{ago(item.createdAt)}</Text>
              </View>
              {item.readAt ? null : <View className="bg-primary mt-2 size-2.5 rounded-full" />}
            </Pressable>
          )
        }}
      />
    </View>
  )
}
