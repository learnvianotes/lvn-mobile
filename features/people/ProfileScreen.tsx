import { CombinedGraphQLErrors } from '@apollo/client/errors'
import { useMutation, useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { ArrowLeft, BadgeCheck, Ellipsis, FileText, GraduationCap, UserCheck, UserPlus } from 'lucide-react-native'
import { useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import {
  BlockUserDocument,
  FollowUserDocument,
  ProfileDocument,
  RemoveFollowerDocument,
  RestrictUserDocument,
  UnblockUserDocument,
  UnfollowUserDocument,
  UnrestrictUserDocument,
} from '@/graphql/generated/graphql'

const YEAR: Record<string, string> = { YEAR_1: '1st year', YEAR_2: '2nd year', YEAR_3: '3rd year', YEAR_4: '4th year', YEAR_5: '5th year', POSTGRADUATE: 'Postgraduate', GRADUATED: 'Graduated', SCHOOL: 'At school', NOT_STUDYING: 'Not studying' }
const KINDS = { NOTE: 'Notes', BLOG: 'Blog', PROJECT: 'Projects', POST: 'Posts' } as const
type Kind = keyof typeof KINDS

/**
 * A person's profile on the phone (lvn-backend ADR-0043): who they are, what they made public by kind, and the viewer's
 * buttons — Follow or Following, and a menu to remove a follower, restrict or block — from `relation.viewerCan`.
 */
export function ProfileScreen({ handle }: { handle: string }) {
  const insets = useSafeAreaInsets()
  const fg = String(useCSSVariable('--color-foreground') ?? '#111827')
  const accent = String(useCSSVariable('--color-primary') ?? '#4f46e5')
  const { data, loading } = useQuery(ProfileDocument, { variables: { handle }, fetchPolicy: 'cache-and-network' })
  const [kind, setKind] = useState<Kind>('NOTE')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [follow] = useMutation(FollowUserDocument)
  const [unfollow] = useMutation(UnfollowUserDocument)
  const [removeFollower] = useMutation(RemoveFollowerDocument)
  const [block] = useMutation(BlockUserDocument)
  const [unblock] = useMutation(UnblockUserDocument)
  const [restrict] = useMutation(RestrictUserDocument)
  const [unrestrict] = useMutation(UnrestrictUserDocument)
  const person = data?.userByHandle

  const act = async (run: (o: { variables: { input: { userId: string } } }) => Promise<{ data?: unknown }>) => {
    if (!person) return
    setBusy(true)
    setError(null)
    try {
      const res = (await run({ variables: { input: { userId: person.id } } })) as { data?: Record<string, { userErrors: { message: string }[] }> }
      const problem = Object.values(res.data ?? {})[0]?.userErrors[0]?.message
      if (problem) setError(problem)
    } catch (e) {
      setError(CombinedGraphQLErrors.is(e) ? (e.errors[0]?.message ?? 'That did not work. Try again.') : 'That did not work. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const header = (
    <View className="flex-row items-center gap-2 px-3 pb-2" style={{ paddingTop: insets.top + 6 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} className="rounded-full p-2">
        <ArrowLeft size={22} color={fg} />
      </Pressable>
    </View>
  )
  if (!person) {
    return (
      <View className="bg-background flex-1">
        {header}
        {loading ? <ActivityIndicator accessibilityLabel="Loading" /> : <Text className="text-muted-foreground px-6 py-16 text-center">This profile is not available.</Text>}
      </View>
    )
  }

  const own = data?.viewer?.id === person.id
  const r = person.relation
  const teacher = person.globalRole === 'TEACHER'
  const kinds: Kind[] = teacher ? ['NOTE', 'BLOG', 'PROJECT', 'POST'] : ['NOTE', 'PROJECT']
  const notes = person.publicNotes.edges.map((e) => e.node)
  const shown = notes.filter((n) => n.kind === kind)
  const study = [person.profile?.department, person.profile?.yearOfStudy ? YEAR[person.profile.yearOfStudy] : null].filter(Boolean).join(' · ')

  const menu = () => {
    if (!r) return
    const options: { text: string; style?: 'destructive' | 'cancel'; onPress?: () => void }[] = []
    if (r.viewerCan.removeFollower) options.push({ text: 'Remove follower', onPress: () => void act(removeFollower) })
    if (r.viewerCan.restrict) options.push({ text: 'Restrict', onPress: () => void act(restrict) })
    if (r.viewerCan.unrestrict) options.push({ text: 'Unrestrict', onPress: () => void act(unrestrict) })
    if (r.viewerCan.block) {
      options.push({
        text: 'Block',
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            'Block this person?',
            "You stop following each other, and neither of you can follow, share with or invite the other. You won't see each other in search. They are not told; you can unblock them any time.",
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Block', style: 'destructive', onPress: () => void act(block) },
            ],
          ),
      })
    }
    if (r.viewerCan.unblock) options.push({ text: 'Unblock', onPress: () => void act(unblock) })
    options.push({ text: 'Cancel', style: 'cancel' })
    Alert.alert(person.displayName, undefined, options)
  }

  return (
    <View className="bg-background flex-1">
      {header}
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 32 }}>
        <View className="bg-card border-border items-center gap-2 rounded-3xl border p-6">
          <View className="bg-secondary size-20 items-center justify-center rounded-full">
            <Text className="text-secondary-foreground text-3xl font-extrabold">{person.displayName.slice(0, 1).toUpperCase()}</Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <Text className="text-2xl font-extrabold" accessibilityRole="header">
              {person.displayName}
            </Text>
            {person.verified ? <BadgeCheck size={20} color={accent} accessibilityLabel="Verified" /> : null}
          </View>
          <Text className="text-muted-foreground text-sm">@{person.handle}</Text>
          {teacher ? (
            <View className="bg-secondary flex-row items-center gap-1 rounded-full px-2.5 py-0.5">
              <GraduationCap size={14} color={accent} />
              <Text className="text-primary text-sm font-semibold">Teacher</Text>
            </View>
          ) : null}
          {study ? <Text className="text-muted-foreground text-sm">{study}</Text> : null}
          {own ? (
            <Pressable accessibilityRole="link" onPress={() => router.push('/people')}>
              <Text className="text-muted-foreground text-sm">
                {person.followerCount ?? 0} {person.followerCount === 1 ? 'follower' : 'followers'} · {person.followingCount ?? 0} following
              </Text>
            </Pressable>
          ) : person.followerMilestone ? (
            <Text className="text-muted-foreground text-sm">{person.followerMilestone.toLocaleString('en-IN')}+ followers</Text>
          ) : null}
          {r?.followedBy ? <Text className="text-muted-foreground bg-muted rounded-full px-2.5 py-0.5 text-xs">Follows you</Text> : null}
          {r ? (
            <View className="mt-2 flex-row items-center gap-2">
              {r.blocked ? (
                <Pressable accessibilityRole="button" disabled={busy} onPress={() => void act(unblock)} className="border-border rounded-full border px-5 py-2.5">
                  <Text className="font-semibold">Unblock</Text>
                </Pressable>
              ) : r.following ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Following, tap to unfollow" disabled={busy} onPress={() => void act(unfollow)} className="border-border flex-row items-center gap-2 rounded-full border px-5 py-2.5">
                  <UserCheck size={16} color={fg} />
                  <Text className="font-semibold">Following</Text>
                </Pressable>
              ) : r.viewerCan.follow ? (
                <Pressable accessibilityRole="button" disabled={busy} onPress={() => void act(follow)} className="bg-primary flex-row items-center gap-2 rounded-full px-5 py-2.5">
                  <UserPlus size={16} color="#ffffff" />
                  <Text className="text-primary-foreground font-semibold">Follow</Text>
                </Pressable>
              ) : null}
              <Pressable accessibilityRole="button" accessibilityLabel="More options" onPress={menu} className="border-border rounded-full border p-2.5">
                <Ellipsis size={18} color={fg} />
              </Pressable>
            </View>
          ) : null}
          {r?.restricted ? <Text className="text-muted-foreground text-center text-xs">Restricted: their comments wait for your approval and they don&apos;t notify you.</Text> : null}
          {error ? (
            <Text accessibilityRole="alert" className="text-destructive text-center text-sm">
              {error}
            </Text>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityRole="tablist">
          {kinds.map((k) => (
            <Pressable
              key={k}
              accessibilityRole="tab"
              accessibilityState={{ selected: k === kind }}
              onPress={() => setKind(k)}
              className={`rounded-full px-4 py-2 ${k === kind ? 'bg-primary' : 'bg-card border-border border'}`}
            >
              <Text className={k === kind ? 'text-primary-foreground font-semibold' : 'font-semibold'}>
                {KINDS[k]} {notes.filter((n) => n.kind === k).length}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {shown.length ? (
          shown.map((n) => (
            <Pressable key={n.id} accessibilityRole="button" onPress={() => router.push(`/notes/${n.id}`)} className="bg-card border-border flex-row items-start gap-3 rounded-2xl border p-4">
              <FileText size={18} color={accent} />
              <Text className="flex-1 font-semibold">{n.title || 'Untitled note'}</Text>
            </Pressable>
          ))
        ) : (
          <Text className="text-muted-foreground py-8 text-center">{kind === 'NOTE' ? 'No public notes yet.' : kind === 'PROJECT' ? 'No projects yet.' : kind === 'BLOG' ? 'No blog posts yet.' : 'No posts yet.'}</Text>
        )}
      </ScrollView>
    </View>
  )
}
