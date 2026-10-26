import { CombinedGraphQLErrors } from '@apollo/client/errors'
import { useMutation, useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { ArrowLeft, BadgeCheck, Ellipsis, FileText, GraduationCap, Handshake, UserCheck, UserPlus } from 'lucide-react-native'
import { useState } from 'react'
import { Alert, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { AchievementBadges } from '@/features/achievements/AchievementBadges'
import { LEVEL } from '@/features/achievements/AchievementsScreen'
import { ReportSheet } from '@/features/moderation/ReportSheet'
import { SOURCE } from '@/features/people/SkillsImport'
import { ActionSheet, type SheetAction } from '@/features/shell/ActionSheet'
import { LoadState } from '@/features/shell/LoadState'
import { openExternal } from '@/lib/open-external'
import { useTheme } from '@/lib/theme'
import {
  BlockUserDocument,
  FollowUserDocument,
  ProfileDocument,
  RemoveConnectionDocument,
  RemoveFollowerDocument,
  RequestConnectionDocument,
  RespondToConnectionRequestDocument,
  RestrictUserDocument,
  UnblockUserDocument,
  UnfollowUserDocument,
  UnrestrictUserDocument,
  WithdrawConnectionRequestDocument,
} from '@/graphql/generated/graphql'

const YEAR: Record<string, string> = { YEAR_1: '1st year', YEAR_2: '2nd year', YEAR_3: '3rd year', YEAR_4: '4th year', YEAR_5: '5th year', POSTGRADUATE: 'Postgraduate', GRADUATED: 'Graduated', SCHOOL: 'At school', NOT_STUDYING: 'Not studying' }
const KINDS = { NOTE: 'Notes', BLOG: 'Blog', PROJECT: 'Projects', POST: 'Posts', SKILLS: 'Skills' } as const
const SKILL_KINDS = { QUALIFICATION: 'Qualifications', EXPERIENCE: 'Experience', SKILL: 'Skills', PROJECT: 'Projects', PUBLICATION: 'Publications' } as const
type Kind = keyof typeof KINDS

/**
 * A person's profile on the phone (lvn-backend ADR-0043): who they are, what they made public by kind, and the viewer's
 * buttons — Follow or Following, and a menu to remove a follower, restrict, block or report — from `relation.viewerCan`.
 */
export function ProfileScreen({ handle }: { handle: string }) {
  const insets = useSafeAreaInsets()
  const fg = String(useCSSVariable('--color-foreground') ?? '#152033')
  const accent = String(useCSSVariable('--color-primary') ?? '#1e4d8c')
  const onBrand = useTheme().palette.brandForeground
  const query = useQuery(ProfileDocument, { variables: { handle }, fetchPolicy: 'cache-and-network' })
  const { data } = query
  const [kind, setKind] = useState<Kind>('NOTE')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [follow] = useMutation(FollowUserDocument)
  const [unfollow] = useMutation(UnfollowUserDocument)
  const [removeFollower] = useMutation(RemoveFollowerDocument)
  const [block] = useMutation(BlockUserDocument)
  const [unblock] = useMutation(UnblockUserDocument)
  const [restrict] = useMutation(RestrictUserDocument)
  const [unrestrict] = useMutation(UnrestrictUserDocument)
  const [connect] = useMutation(RequestConnectionDocument)
  const [disconnect] = useMutation(RemoveConnectionDocument)
  const [respond] = useMutation(RespondToConnectionRequestDocument)
  const [withdraw] = useMutation(WithdrawConnectionRequestDocument)
  const person = data?.userByHandle

  const act = (run: (o: { variables: { input: { userId: string } } }) => Promise<{ data?: unknown }>) => (person ? attempt(() => run({ variables: { input: { userId: person.id } } })) : Promise.resolve())

  /** Runs one change and shows what went wrong in the API's words. */
  const attempt = async (call: () => Promise<{ data?: unknown }>) => {
    setBusy(true)
    setError(null)
    try {
      const res = (await call()) as { data?: Record<string, { userErrors: { message: string }[] }> }
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
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} className="size-10 items-center justify-center rounded-full">
        <ArrowLeft size={22} color={fg} />
      </Pressable>
    </View>
  )
  if (!person) {
    return (
      <View className="bg-background flex-1">
        {header}
        {data ? <Text className="text-muted-foreground px-6 py-16 text-center">This profile is not available.</Text> : <LoadState query={query} message="This profile could not load." className="mx-4" />}
      </View>
    )
  }

  const own = data?.viewer?.id === person.id
  const r = person.relation
  const teacher = person.globalRole === 'TEACHER'
  const kinds: Kind[] = teacher ? ['NOTE', 'BLOG', 'PROJECT', 'POST', 'SKILLS'] : ['NOTE', 'PROJECT']
  const notes = person.publicNotes.edges.map((e) => e.node)
  const shown = notes.filter((n) => n.kind === kind)
  const study = [person.profile?.department, person.profile?.yearOfStudy ? YEAR[person.profile.yearOfStudy] : null].filter(Boolean).join(' · ')

  // The menu: Android's native alert holds three buttons, more than that needs a sheet.
  const menuActions: SheetAction[] = []
  if (r) {
    if (r.viewerCan.removeConnection) menuActions.push({ text: 'Remove connection', onPress: () => void act(disconnect) })
    if (r.viewerCan.removeFollower) menuActions.push({ text: 'Remove follower', onPress: () => void act(removeFollower) })
    if (r.viewerCan.restrict) menuActions.push({ text: 'Restrict', onPress: () => void act(restrict) })
    if (r.viewerCan.unrestrict) menuActions.push({ text: 'Unrestrict', onPress: () => void act(unrestrict) })
    if (r.viewerCan.block) {
      menuActions.push({
        text: 'Block',
        destructive: true,
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
    if (r.viewerCan.unblock) menuActions.push({ text: 'Unblock', onPress: () => void act(unblock) })
    menuActions.push({ text: 'Report', onPress: () => setReporting(true) })
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
              ) : r.viewerCan.follow || (!data?.viewer?.verified && !r.blocked) ? (
                // Unverified, Follow stays: pressing it says why it needs verification (ADR-0017).
                <Pressable accessibilityRole="button" disabled={busy} onPress={() => void act(follow)} className="bg-primary flex-row items-center gap-2 rounded-full px-5 py-2.5">
                  <UserPlus size={16} color={onBrand} />
                  <Text className="text-primary-foreground font-semibold">Follow</Text>
                </Pressable>
              ) : null}
              {r.connected ? (
                <View className="bg-secondary flex-row items-center gap-1.5 rounded-full px-4 py-2.5">
                  <Handshake size={16} color={accent} />
                  <Text className="text-primary font-semibold">Connected</Text>
                </View>
              ) : r.pendingConnection?.direction === 'INCOMING' ? (
                <>
                  <Pressable accessibilityRole="button" disabled={busy} onPress={() => void attempt(() => respond({ variables: { input: { requestId: r.pendingConnection!.requestId, accept: true } } }))} className="bg-primary rounded-full px-4 py-2.5">
                    <Text className="text-primary-foreground font-semibold">Accept</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" disabled={busy} onPress={() => void attempt(() => respond({ variables: { input: { requestId: r.pendingConnection!.requestId, accept: false } } }))} className="border-border rounded-full border px-4 py-2.5">
                    <Text className="font-semibold">Decline</Text>
                  </Pressable>
                </>
              ) : r.pendingConnection?.direction === 'OUTGOING' ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Connection requested, tap to withdraw" disabled={busy} onPress={() => void attempt(() => withdraw({ variables: { input: { requestId: r.pendingConnection!.requestId } } }))} className="border-border rounded-full border px-4 py-2.5">
                  <Text className="font-semibold">Requested</Text>
                </Pressable>
              ) : r.viewerCan.requestConnection ? (
                <Pressable accessibilityRole="button" disabled={busy} onPress={() => void act(connect)} className="border-border flex-row items-center gap-1.5 rounded-full border px-4 py-2.5">
                  <Handshake size={16} color={fg} />
                  <Text className="font-semibold">Connect</Text>
                </Pressable>
              ) : null}
              <Pressable accessibilityRole="button" accessibilityLabel="More options" onPress={() => setMenuOpen(true)} className="border-border rounded-full border p-2.5">
                <Ellipsis size={18} color={fg} />
              </Pressable>
            </View>
          ) : null}
          {r?.restricted ? <Text className="text-muted-foreground text-center text-xs">Restricted: their comments wait for your approval and they don&apos;t notify you.</Text> : null}
          {r ? <ActionSheet name="profile-menu" title={person.displayName} actions={menuActions} open={menuOpen} onClose={() => setMenuOpen(false)} /> : null}
          {r ? <ReportSheet entityType="USER" entityId={person.id} open={reporting} onClose={() => setReporting(false)} /> : null}
          {error ? (
            <Text accessibilityRole="alert" className="text-destructive text-center text-sm">
              {error}
            </Text>
          ) : null}
        </View>

        {person.achievements?.length ? (
          // Achievements an adult chose to show (lvn-backend ADR-0080); the person always sees their own.
          <View className="gap-3">
            <View className="flex-row items-center gap-2">
              <Text className="flex-1 text-base font-bold" accessibilityRole="header">
                Achievements
              </Text>
              {person.contribution && person.contribution.level !== 'NEWCOMER' ? <Text className="text-primary text-sm font-semibold">{LEVEL[person.contribution.level]}</Text> : null}
            </View>
            <AchievementBadges items={person.achievements} wrap />
          </View>
        ) : null}

        <View className="flex-row flex-wrap gap-2" accessibilityRole="tablist">
          {kinds.map((k) => (
            <Pressable
              key={k}
              accessibilityRole="tab"
              accessibilityState={{ selected: k === kind }}
              onPress={() => setKind(k)}
              className={`rounded-full px-4 py-2 ${k === kind ? 'bg-primary' : 'bg-card border-border border'}`}
            >
              <Text className={k === kind ? 'text-primary-foreground font-semibold' : 'font-semibold'}>
                {KINDS[k]}{k === 'SKILLS' ? '' : ` ${notes.filter((n) => n.kind === k).length}`}
              </Text>
            </Pressable>
          ))}
        </View>

        {kind === 'SKILLS' ? (
          <>
            {own ? (
              <Pressable accessibilityRole="button" onPress={() => router.push('/skills')} className="border-border self-start rounded-full border px-4 py-2">
                <Text className="font-semibold">Edit your Skills tab</Text>
              </Pressable>
            ) : null}
            <SkillsTab profile={person.teacherProfile} />
          </>
        ) : shown.length ? (
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

/** A teacher's Skills tab (ADR-0012, ADR-0077): headline, about, and items grouped by kind; imported ones say where from. */
function SkillsTab({
  profile,
}: {
  profile: { headline: string | null; bio: string | null; skills: { id: string; kind: keyof typeof SKILL_KINDS; name: string; detail: string | null; source: string; sourceUrl?: string | null; fetchedAt?: string | null }[] } | null
}) {
  if (!profile || (!profile.headline && !profile.bio && !profile.skills.length)) return <Text className="text-muted-foreground py-8 text-center">Nothing here yet.</Text>
  return (
    <View className="gap-4">
      {profile.headline ? <Text className="text-lg font-semibold">{profile.headline}</Text> : null}
      {profile.bio ? <Text className="text-muted-foreground">{profile.bio}</Text> : null}
      {(Object.keys(SKILL_KINDS) as (keyof typeof SKILL_KINDS)[]).map((k) => {
        const items = profile.skills.filter((s) => s.kind === k)
        if (!items.length) return null
        return (
          <View key={k} className="gap-2">
            <Text className="text-muted-foreground text-xs font-semibold uppercase" accessibilityRole="header">
              {SKILL_KINDS[k]}
            </Text>
            {items.map((s) => (
              <View key={s.id} className="bg-card border-border rounded-2xl border px-4 py-3">
                <Text className="font-semibold">{s.name}</Text>
                {s.detail ? <Text className="text-muted-foreground text-sm">{s.detail}</Text> : null}
                {s.source !== 'MANUAL' ? (
                  <Pressable accessibilityRole="link" disabled={!s.sourceUrl} onPress={() => openExternal(s.sourceUrl)}>
                    <Text className="text-muted-foreground mt-1 text-xs">
                      From {SOURCE[s.source]}
                      {s.fetchedAt ? ` · checked ${new Date(s.fetchedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        )
      })}
    </View>
  )
}
