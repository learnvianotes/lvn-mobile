import { useQuery } from '@apollo/client/react'
import { router, type Href } from 'expo-router'
import { Activity, Bookmark, CalendarDays, ChevronRight, GraduationCap, History, Layers, Library, NotebookPen, Settings, ShieldCheck, Sparkles, UserRound, Users, type LucideIcon } from 'lucide-react-native'
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { SafeAreaView } from '@/components/ui/safe-area-view'
import { Text } from '@/components/ui/text'
import { AchievementBadges } from '@/features/achievements/AchievementBadges'
import { AccountStanding } from '@/features/moderation/Standing'
import { useLocal } from '@/features/notes/hooks'
import * as db from '@/features/notes/store/db'
import { ReviewRequests, VerifyCard } from '@/features/verification/Verification'
import { MyAchievementsDocument, ProfileTabDocument, ViewerDocument, type ViewerFieldsFragment } from '@/graphql/generated/graphql'
import { YEARS } from './AccountDetails'
import { copy } from './copy'
import { Notice } from './Notice'

type Row = { label: string; icon: LucideIcon; href: Href; show?: (v: ViewerFieldsFragment) => boolean }

/** Board A's list (lvn-backend ADR-0076), then the rest of what is the person's; each row opens a screen. */
const ROWS: Row[] = [
  { label: 'My notes', icon: NotebookPen, href: '/notes' },
  { label: 'Saved', icon: Bookmark, href: '/saved' },
  { label: 'My groups', icon: Users, href: { pathname: '/community', params: { section: 'places' } } },
  { label: 'My classrooms', icon: GraduationCap, href: { pathname: '/community', params: { section: 'places' } } },
  { label: 'Learning history', icon: History, href: '/history' },
  { label: 'Exams', icon: CalendarDays, href: '/exams' },
  { label: 'Rhythm', icon: Activity, href: '/rhythm' },
  { label: 'Review flashcards', icon: Layers, href: '/review' },
  { label: 'Resources', icon: Library, href: '/resources' },
  { label: 'Your resources', icon: Library, href: '/resources/mine' },
  { label: 'See your profile', icon: UserRound, href: '/u/me' },
  { label: 'Followers, following and blocked people', icon: Users, href: '/people' },
]

/**
 * The Profile tab as board A draws it (lvn-backend ADR-0076): who the person is (department and year when set), their
 * notes, followers and following, then their places and learning. The account itself (email, verification, study
 * details, data, AI, sign-out) is behind the gear, in Settings.
 */
export function ProfileTab() {
  const { data, loading } = useQuery(ViewerDocument)
  const viewer = data?.viewer
  const fg = String(useCSSVariable('--color-foreground') ?? '#111827')
  return (
    <SafeAreaView className="bg-background flex-1">
      <ScrollView contentContainerClassName="gap-5 px-5 pb-32 pt-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold tracking-tight" accessibilityRole="header">
            Profile
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Settings" hitSlop={8} onPress={() => router.push('/settings')} className="rounded-full p-2">
            <Settings size={22} color={fg} />
          </Pressable>
        </View>
        {viewer ? <AccountStanding userId={viewer.id} /> : null}
        {viewer ? <Header viewer={viewer} /> : loading ? <ActivityIndicator accessibilityLabel="Loading" /> : <Notice>{copy.errors.generic}</Notice>}
        {/* Without a college email (ADR-0019): a teacher vouches, or our team checks proof of study. */}
        {viewer && !viewer.verified ? <VerifyCard restrictedMinor={!!viewer.restrictedMinor} /> : null}
        {viewer?.globalRole === 'TEACHER' && viewer.verified ? <ReviewRequests /> : null}
        {viewer ? <Achievements /> : null}
        {viewer ? <Links viewer={viewer} /> : null}
      </ScrollView>
    </SafeAreaView>
  )
}

function Header({ viewer }: { viewer: ViewerFieldsFragment }) {
  const tab = useQuery(ProfileTabDocument, { fetchPolicy: 'cache-and-network' }).data?.viewer
  // The person's own notes on this phone (the local copy keeps them all, synced).
  const notes = useLocal(() => db.listNotes().then((all) => all.filter((n) => n.access === 'OWNER').length).catch(() => undefined), [])
  const study = [tab?.profile?.department, tab?.profile?.yearOfStudy ? YEARS[tab.profile.yearOfStudy] : null].filter(Boolean).join(' · ')
  return (
    <View className="bg-card border-border gap-4 rounded-3xl border p-5">
      <View className="flex-row items-center gap-4">
        <View className="bg-secondary size-16 items-center justify-center rounded-full" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Text className="text-secondary-foreground text-2xl font-bold">{viewer.displayName.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center gap-1.5">
            <Text className="text-lg font-bold">{viewer.displayName}</Text>
            {viewer.verified ? <ShieldCheck size={16} color="#16a34a" accessibilityLabel="Verified" /> : null}
          </View>
          <Text className="text-muted-foreground text-sm">@{viewer.handle}</Text>
          {study ? <Text className="text-muted-foreground text-sm">{study}</Text> : null}
        </View>
      </View>
      <View className="flex-row">
        <Stat label="Notes" value={notes} onPress={() => router.push('/notes')} />
        <Stat label="Followers" value={tab?.followerCount ?? undefined} onPress={() => router.push('/people')} />
        <Stat label="Following" value={tab?.followingCount ?? undefined} onPress={() => router.push('/people')} />
      </View>
    </View>
  )
}

function Stat({ label, value, onPress }: { label: string; value: number | undefined; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={value === undefined ? label : `${value} ${label.toLowerCase()}`} onPress={onPress} className="flex-1 items-center gap-0.5">
      <Text className="text-xl font-extrabold">{value ?? '–'}</Text>
      <Text className="text-muted-foreground text-xs">{label}</Text>
    </Pressable>
  )
}

/** Board A's achievement row (lvn-backend ADR-0080): the four most recent, and all of them with points on the next screen. */
function Achievements() {
  const { data } = useQuery(MyAchievementsDocument, { fetchPolicy: 'cache-and-network' })
  const items = data?.viewer?.achievements ?? []
  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 text-base font-bold" accessibilityRole="header">
          Achievements
        </Text>
        <Pressable accessibilityRole="link" accessibilityLabel="See all achievements" hitSlop={8} onPress={() => router.push('/achievements')}>
          <Text className="text-primary text-sm font-semibold">See all</Text>
        </Pressable>
      </View>
      {items.length ? (
        <AchievementBadges items={items.slice(0, 4)} />
      ) : data ? (
        <Pressable accessibilityRole="link" onPress={() => router.push('/achievements')} className="border-border rounded-2xl border border-dashed p-4">
          <Text className="text-muted-foreground text-center text-sm">Master a topic or meet your Rhythm weeks to earn your first achievement.</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

/** The rows, then a teacher's Skills tab, the way to teach for students, and the queues of platform admins. */
function Links({ viewer }: { viewer: ViewerFieldsFragment }) {
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  const primary = String(useCSSVariable('--color-primary') ?? '#2563eb')
  const rows: Row[] = [
    ...ROWS.map((r) => (r.href === '/u/me' ? { ...r, href: `/u/${viewer.handle}` as Href } : r)),
    {
      label: viewer.teacherStatus === 'PENDING' ? 'Teacher application: being reviewed' : viewer.teacherStatus === 'DECLINED' ? 'Teacher application: not approved — apply again' : 'Teach on LearnViaNotes',
      icon: GraduationCap,
      href: '/teach',
      show: (v) => v.globalRole === 'STUDENT' && !v.restrictedMinor,
    },
    { label: 'Your Skills tab', icon: Sparkles, href: '/skills', show: (v) => v.globalRole === 'TEACHER' || v.teacherStatus === 'PENDING' },
    { label: 'Proof of study to review', icon: ShieldCheck, href: '/admin/verification', show: (v) => v.globalRole === 'PLATFORM_ADMIN' },
    { label: 'Moderation queue', icon: ShieldCheck, href: '/admin/moderation', show: (v) => v.globalRole === 'PLATFORM_ADMIN' },
  ]
  return (
    <View className="bg-card border-border rounded-2xl border px-2 py-1">
      {rows
        .filter((r) => !r.show || r.show(viewer))
        .map(({ label, icon: Icon, href }) => (
          <Pressable key={label} accessibilityRole="link" accessibilityLabel={label} onPress={() => router.push(href)} className="flex-row items-center gap-3 rounded-xl px-3 py-3">
            <Icon size={20} color={primary} />
            <Text className="flex-1 font-semibold">{label}</Text>
            <ChevronRight size={18} color={muted} />
          </Pressable>
        ))}
    </View>
  )
}
