import { useMutation, useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { useState } from 'react'
import { FlatList, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { MyPeopleDocument, RemoveFollowerDocument, UnblockUserDocument, UnfollowUserDocument, UnrestrictUserDocument, type PersonFieldsFragment } from '@/graphql/generated/graphql'

type Tab = 'followers' | 'following' | 'blocked' | 'restricted'
const TABS: Record<Tab, { label: string; undo: string; empty: string }> = {
  followers: { label: 'Followers', undo: 'Remove', empty: 'Nobody follows you yet.' },
  following: { label: 'Following', undo: 'Unfollow', empty: "You don't follow anyone yet." },
  blocked: { label: 'Blocked', undo: 'Unblock', empty: "You haven't blocked anyone." },
  restricted: { label: 'Restricted', undo: 'Unrestrict', empty: "You haven't restricted anyone." },
}

/** The person's people (lvn-backend ADR-0043): followers (young learners counted, not named), following, blocked, restricted. */
export function PeopleScreen() {
  const insets = useSafeAreaInsets()
  const fg = String(useCSSVariable('--color-foreground') ?? '#111827')
  const [tab, setTab] = useState<Tab>('followers')
  const { data, refetch } = useQuery(MyPeopleDocument, { variables: { first: 100 }, fetchPolicy: 'cache-and-network' })
  const [removeFollower] = useMutation(RemoveFollowerDocument)
  const [unfollow] = useMutation(UnfollowUserDocument)
  const [unblock] = useMutation(UnblockUserDocument)
  const [unrestrict] = useMutation(UnrestrictUserDocument)
  const lists: Record<Tab, PersonFieldsFragment[]> = {
    followers: data?.myFollowers.edges.map((e) => e.node) ?? [],
    following: data?.myFollowing.edges.map((e) => e.node) ?? [],
    blocked: data?.myBlocked.map((e) => e.node) ?? [],
    restricted: data?.myRestricted.map((e) => e.node) ?? [],
  }
  const counts: Record<Tab, number> = {
    followers: data?.viewer?.followerCount ?? lists.followers.length,
    following: data?.viewer?.followingCount ?? lists.following.length,
    blocked: lists.blocked.length,
    restricted: lists.restricted.length,
  }
  const undo = async (p: PersonFieldsFragment) => {
    const variables = { input: { userId: p.id } }
    if (tab === 'followers') await removeFollower({ variables })
    if (tab === 'following') await unfollow({ variables })
    if (tab === 'blocked') await unblock({ variables })
    if (tab === 'restricted') await unrestrict({ variables })
    await refetch()
  }
  const hidden = tab === 'followers' ? counts.followers - lists.followers.length : 0
  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top + 6 }}>
      <View className="flex-row items-center gap-2 px-3 pb-2">
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} className="rounded-full p-2">
          <ArrowLeft size={22} color={fg} />
        </Pressable>
        <Text className="flex-1 text-xl font-extrabold" accessibilityRole="header">
          Your people
        </Text>
      </View>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 8 }} accessibilityRole="tablist">
          {(Object.keys(TABS) as Tab[]).map((k) => (
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
        ListEmptyComponent={<Text className="text-muted-foreground py-12 text-center">{TABS[tab].empty}</Text>}
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
            <Pressable accessibilityRole="button" accessibilityLabel={`${TABS[tab].undo} ${item.displayName}`} onPress={() => void undo(item)} className="border-border rounded-full border px-3 py-1.5">
              <Text className="text-sm font-semibold">{TABS[tab].undo}</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  )
}
