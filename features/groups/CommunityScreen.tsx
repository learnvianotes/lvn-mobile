import { useMutation, useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { Globe, Lock, Plus, Search, Users } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { Pressable, ScrollView, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { ClassesSection } from '@/features/classes/ClassesSection'
import { ActivityFeed, FollowingFeed } from '@/features/feeds/Feeds'
import { AnswerMentorInviteDocument, DiscoverGroupsDocument, MyGroupsDocument, MyMentorInvitesDocument, type GroupCardFragment } from '@/graphql/generated/graphql'
import { attempt, ROLE } from './shared'

type Section = 'activity' | 'following' | 'places'
const SECTIONS: Record<Section, string> = { activity: 'Activity', following: 'Following', places: 'Groups & classes' }

/**
 * The Community tab (spec §13.1, lvn-backend ADR-0045, ADR-0046, ADR-0049): the activity of your groups and classes,
 * the Following feed, and your classes (with a class code to enter), your groups and public groups to find. Anyone
 * verified starts a group here; teachers start classes from the classes section.
 */
export function CommunityScreen() {
  const insets = useSafeAreaInsets()
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  const accent = String(useCSSVariable('--color-primary') ?? '#4f46e5')
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
  const [section, setSection] = useState<Section>('activity')
  return (
    <ScrollView className="bg-background flex-1" contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: insets.bottom + 100, gap: 16 }} keyboardShouldPersistTaps="handled">
      <Text className="text-2xl font-extrabold" accessibilityRole="header">
        Community
      </Text>
      <View accessibilityRole="tablist" className="flex-row flex-wrap gap-2">
        {(Object.keys(SECTIONS) as Section[]).map((k) => (
          <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: k === section }} onPress={() => setSection(k)} className={`rounded-full px-4 py-2 ${k === section ? 'bg-primary' : 'bg-card border-border border'}`}>
            <Text className={k === section ? 'text-primary-foreground font-semibold' : 'font-semibold'}>{SECTIONS[k]}</Text>
          </Pressable>
        ))}
      </View>
      {section === 'activity' ? <ActivityFeed /> : null}
      {section === 'following' ? <FollowingFeed /> : null}
      {section === 'places' ? (
        <>
      <ClassesSection />
      <MentorInvites onAnswered={() => void mine.refetch()} />
      <View className="flex-row items-center justify-between">
        <Text className="text-muted-foreground text-sm font-semibold">Your groups</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push('/groups/new')} className="flex-row items-center gap-1 py-1">
          <Plus size={16} color={accent} />
          <Text className="text-primary text-sm font-semibold">New group</Text>
        </Pressable>
      </View>
      {mine.data?.myGroups.length ? mine.data.myGroups.map((g) => <GroupRow key={g.id} group={g} />) : mine.data ? <Text className="text-muted-foreground">You&apos;re not in any group yet. Find one below.</Text> : null}
      <Text className="text-muted-foreground text-sm font-semibold">Find a group</Text>
      <View className="bg-card border-border flex-row items-center gap-2 rounded-2xl border px-3">
        <Search size={18} color={muted} />
        <TextInput accessibilityLabel="Search public groups" value={query} onChangeText={setQuery} placeholder="Search public groups…" placeholderTextColor={muted} className="text-foreground flex-1 py-3 text-base" autoCorrect={false} />
      </View>
      {discover.length ? discover.map((g) => <GroupRow key={g.id} group={g} />) : found.data ? <Text className="text-muted-foreground text-sm">No public groups match.</Text> : null}
        </>
      ) : null}
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

/** Teachers asked to mentor a project workspace (lvn-backend ADR-0048). */
function MentorInvites({ onAnswered }: { onAnswered: () => void }) {
  const { data, refetch } = useQuery(MyMentorInvitesDocument, { fetchPolicy: 'cache-and-network' })
  const [answer] = useMutation(AnswerMentorInviteDocument)
  const invites = data?.myMentorInvites ?? []
  if (!invites.length) return null
  const reply = async (inviteId: string, accept: boolean) => {
    await attempt(() => answer({ variables: { inviteId, accept } }))
    await refetch()
    onAnswered()
  }
  return (
    <View className="gap-2">
      <Text className="text-muted-foreground text-sm font-semibold">Invites to mentor</Text>
      {invites.map((i) => (
        <View key={i.id} className="bg-card border-primary gap-2 rounded-2xl border p-4">
          <Text className="font-semibold">{i.group.name}</Text>
          <Text className="text-muted-foreground text-sm">{i.invitedBy.displayName} asked you to mentor this project</Text>
          <View className="flex-row gap-2">
            <Pressable accessibilityRole="button" onPress={() => void reply(i.id, true)} className="bg-primary rounded-full px-4 py-2">
              <Text className="text-primary-foreground font-semibold">Accept</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => void reply(i.id, false)} className="border-border rounded-full border px-4 py-2">
              <Text className="font-semibold">Decline</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  )
}
