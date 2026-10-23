import { useMutation, useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { useState } from 'react'
import { FlatList, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { LoadState } from '@/features/shell/LoadState'
import {
  MyPeopleDocument,
  RemoveConnectionDocument,
  RemoveFollowerDocument,
  RespondToConnectionRequestDocument,
  UnblockUserDocument,
  UnfollowUserDocument,
  UnrestrictUserDocument,
  WithdrawConnectionRequestDocument,
  type PersonFieldsFragment,
} from '@/graphql/generated/graphql'

type Tab = 'followers' | 'following' | 'connections' | 'requests' | 'blocked' | 'restricted'
const TABS: Record<Tab, { label: string; undo: string; empty: string }> = {
  followers: { label: 'Followers', undo: 'Remove', empty: 'Nobody follows you yet.' },
  following: { label: 'Following', undo: 'Unfollow', empty: "You don't follow anyone yet." },
  connections: { label: 'Connections', undo: 'Remove', empty: 'You have no connections yet. Connect with teachers from their profiles.' },
  requests: { label: 'Requests', undo: 'Decline', empty: 'No connection requests.' },
  blocked: { label: 'Blocked', undo: 'Unblock', empty: "You haven't blocked anyone." },
  restricted: { label: 'Restricted', undo: 'Unrestrict', empty: "You haven't restricted anyone." },
}

/** The person's people (lvn-backend ADR-0043): followers (young learners counted, not named), following, blocked, restricted. */
export function PeopleScreen() {
  const insets = useSafeAreaInsets()
  const fg = String(useCSSVariable('--color-foreground') ?? '#111827')
  const [tab, setTab] = useState<Tab>('followers')
  const query = useQuery(MyPeopleDocument, { variables: { first: 100 }, fetchPolicy: 'cache-and-network' })
  const { data, refetch } = query
  const [removeFollower] = useMutation(RemoveFollowerDocument)
  const [unfollow] = useMutation(UnfollowUserDocument)
  const [unblock] = useMutation(UnblockUserDocument)
  const [unrestrict] = useMutation(UnrestrictUserDocument)
  const [removeConnection] = useMutation(RemoveConnectionDocument)
  const [respond] = useMutation(RespondToConnectionRequestDocument)
  const [withdraw] = useMutation(WithdrawConnectionRequestDocument)
  const requests = data?.myConnectionRequests ?? []
  const requestOf = (p: PersonFieldsFragment) => requests.find((r) => r.person.id === p.id)!
  const lists: Record<Tab, PersonFieldsFragment[]> = {
    followers: data?.myFollowers.edges.map((e) => e.node) ?? [],
    following: data?.myFollowing.edges.map((e) => e.node) ?? [],
    connections: data?.myConnections.map((e) => e.node) ?? [],
    requests: requests.map((r) => r.person),
    blocked: data?.myBlocked.map((e) => e.node) ?? [],
    restricted: data?.myRestricted.map((e) => e.node) ?? [],
  }
  const counts: Record<Tab, number> = {
    followers: data?.viewer?.followerCount ?? lists.followers.length,
    following: data?.viewer?.followingCount ?? lists.following.length,
    connections: lists.connections.length,
    requests: requests.length,
    blocked: lists.blocked.length,
    restricted: lists.restricted.length,
  }
  const undo = async (p: PersonFieldsFragment) => {
    const variables = { input: { userId: p.id } }
    if (tab === 'followers') await removeFollower({ variables })
    if (tab === 'following') await unfollow({ variables })
    if (tab === 'connections') await removeConnection({ variables })
    if (tab === 'requests') {
      const r = requestOf(p)
      if (r.direction === 'OUTGOING') await withdraw({ variables: { input: { requestId: r.id } } })
      else await respond({ variables: { input: { requestId: r.id, accept: false } } })
    }
    if (tab === 'blocked') await unblock({ variables })
    if (tab === 'restricted') await unrestrict({ variables })
    await refetch()
  }
  const hidden = tab === 'followers' ? counts.followers - lists.followers.length : 0
  // Connections are for teachers (ADR-0013): their tabs show for teachers, or when there is something in them.
  const teacher = data?.viewer?.globalRole === 'TEACHER'
  const tabs = (Object.keys(TABS) as Tab[]).filter((k) => (k === 'connections' || k === 'requests' ? teacher || counts[k] > 0 : true))
  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top + 6 }}>
      <View className="flex-row items-center gap-2 px-3 pb-2">
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} className="size-10 items-center justify-center rounded-full">
          <ArrowLeft size={22} color={fg} />
        </Pressable>
        <Text className="flex-1 text-xl font-extrabold" accessibilityRole="header">
          Your people
        </Text>
      </View>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 8 }} accessibilityRole="tablist">
          {tabs.map((k) => (
            <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: k === tab }} onPress={() => setTab(k)} className={`rounded-full px-4 py-2 ${k === tab ? 'bg-primary' : 'bg-card border-border border'}`}>
              <Text className={k === tab ? 'text-primary-foreground font-semibold' : 'font-semibold'}>
                {TABS[k].label} {counts[k]}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <FlatList
        data={lists[tab]}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 24 }}
        ListEmptyComponent={data ? <Text className="text-muted-foreground py-12 text-center">{TABS[tab].empty}</Text> : <LoadState query={query} message="Your people could not load." />}
        ListFooterComponent={hidden > 0 ? <Text className="text-muted-foreground text-xs">{hidden === 1 ? '1 more follower is' : `${hidden} more followers are`} not shown by name: young learners never appear in lists.</Text> : null}
        renderItem={({ item }) => (
          <View className="bg-card border-border flex-row items-center gap-3 rounded-2xl border p-3">
            <Pressable accessibilityRole="link" onPress={() => router.push(`/u/${item.handle}`)} className="flex-1 flex-row items-center gap-3">
              <View className="bg-secondary size-10 items-center justify-center rounded-full">
                <Text className="text-secondary-foreground font-bold">{item.displayName.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View className="flex-1">
                <Text className="font-semibold">{item.displayName}</Text>
                <Text className="text-muted-foreground text-xs">@{item.handle}</Text>
              </View>
            </Pressable>
            {tab === 'requests' && requestOf(item).direction === 'INCOMING' ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`Accept ${item.displayName}`} onPress={() => void respond({ variables: { input: { requestId: requestOf(item).id, accept: true } } }).then(() => refetch())} className="bg-primary rounded-full px-3 py-1.5">
                <Text className="text-primary-foreground text-sm font-semibold">Accept</Text>
              </Pressable>
            ) : null}
            {(() => {
              const label = tab === 'requests' && requestOf(item).direction === 'OUTGOING' ? 'Withdraw' : TABS[tab].undo
              return (
                <Pressable accessibilityRole="button" accessibilityLabel={`${label} ${item.displayName}`} onPress={() => void undo(item)} className="border-border rounded-full border px-3 py-1.5">
                  <Text className="text-sm font-semibold">{label}</Text>
                </Pressable>
              )
            })()}
          </View>
        )}
      />
    </View>
  )
}
