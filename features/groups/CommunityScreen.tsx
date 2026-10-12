import { useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { Globe, Lock, Search, Users } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { Pressable, ScrollView, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { ClassesSection } from '@/features/classes/ClassesSection'
import { DiscoverGroupsDocument, MyGroupsDocument, type GroupCardFragment } from '@/graphql/generated/graphql'
import { ROLE } from './shared'

/**
 * The Community tab (spec §13.1, lvn-backend ADR-0045, ADR-0046): your classes and a class code to enter, your groups, and
 * public groups to find. Classes and groups start on the web.
 */
export function CommunityScreen() {
  const insets = useSafeAreaInsets()
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  const mine = useQuery(MyGroupsDocument, { fetchPolicy: 'cache-and-network' })
  const [query, setQuery] = useState('')
  const [settled, setSettled] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setSettled(query.trim()), 250)
    return () => clearTimeout(timer)
  }, [query])
  const found = useQuery(DiscoverGroupsDocument, { variables: { query: settled || null }, fetchPolicy: 'cache-and-network' })
  const myIds = new Set(mine.data?.myGroups.map((g) => g.id))
  const discover = (found.data?.discoverGroups ?? []).filter((g) => !myIds.has(g.id))
  return (
    <ScrollView className="bg-background flex-1" contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: insets.bottom + 100, gap: 16 }} keyboardShouldPersistTaps="handled">
      <Text className="text-2xl font-extrabold" accessibilityRole="header">
        Community
      </Text>
      <ClassesSection />
      <Text className="text-muted-foreground text-sm font-semibold">Your groups</Text>
      {mine.data?.myGroups.length ? mine.data.myGroups.map((g) => <GroupRow key={g.id} group={g} />) : mine.data ? <Text className="text-muted-foreground">You&apos;re not in any group yet. Find one below.</Text> : null}
      <Text className="text-muted-foreground text-sm font-semibold">Find a group</Text>
      <View className="bg-card border-border flex-row items-center gap-2 rounded-2xl border px-3">
        <Search size={18} color={muted} />
        <TextInput accessibilityLabel="Search public groups" value={query} onChangeText={setQuery} placeholder="Search public groups…" placeholderTextColor={muted} className="text-foreground flex-1 py-3 text-base" autoCorrect={false} />
      </View>
      {discover.length ? discover.map((g) => <GroupRow key={g.id} group={g} />) : found.data ? <Text className="text-muted-foreground text-sm">No public groups match.</Text> : null}
    </ScrollView>
  )
}

function GroupRow({ group }: { group: GroupCardFragment }) {
  const accent = String(useCSSVariable('--color-primary') ?? '#4f46e5')
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  const Icon = group.privacy === 'PRIVATE' ? Lock : Globe
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={group.name} onPress={() => router.push(`/groups/${group.id}`)} className="bg-card border-border gap-1.5 rounded-2xl border p-4">
      <View className="flex-row items-center gap-2">
        <Icon size={16} color={accent} />
        <Text className="flex-1 font-semibold" numberOfLines={1}>
          {group.name}
        </Text>
        {group.viewerRole ? <Text className="text-primary text-xs font-semibold">{ROLE[group.viewerRole]}</Text> : null}
      </View>
      {group.description ? (
        <Text className="text-muted-foreground text-sm" numberOfLines={2}>
          {group.description}
        </Text>
      ) : null}
      <View className="flex-row items-center gap-1.5">
        <Users size={14} color={muted} />
        <Text className="text-muted-foreground text-xs">
          {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
        </Text>
      </View>
    </Pressable>
  )
}
