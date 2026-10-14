import { useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { ArrowLeft, Trophy } from 'lucide-react-native'
import { Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { LoadState } from '@/features/shell/LoadState'
import { ContestsDocument, type ContestsQuery } from '@/graphql/generated/graphql'

type Item = ContestsQuery['contests'][number]

const STATE: Record<Item['state'], string> = { UPCOMING: 'Upcoming', OPEN: 'Open', CLOSED: 'Closed' }
const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

/**
 * Weekly contests on the phone (lvn-backend ADR-0082): the open one as board A draws it, then upcoming and recent
 * ones. A contest is a timed quiz with every answer explained after; nobody is listed, each score is its person's.
 */
export function ContestsScreen() {
  const insets = useSafeAreaInsets()
  const fg = String(useCSSVariable('--color-foreground') ?? '#111827')
  const query = useQuery(ContestsDocument, { fetchPolicy: 'cache-and-network' })
  const { data } = query
  const list = data?.contests ?? []
  return (
    <View className="bg-background flex-1">
      <View className="flex-row items-center gap-2 px-3 pb-2" style={{ paddingTop: insets.top + 6 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} className="rounded-full p-2">
          <ArrowLeft size={22} color={fg} />
        </Pressable>
        <Text className="text-lg font-bold" accessibilityRole="header">
          Contests
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 32 }}>
        <Text className="text-muted-foreground text-sm">A weekly set of questions with a timer, and every answer explained after. Your score is yours: nobody is listed.</Text>
        <LoadState query={query} message="Contests could not load." />
        {data && !list.length ? <Text className="text-muted-foreground text-center text-sm">No contest is open this week. Check back on Saturday.</Text> : null}
        {list.map((c) => (c.state === 'OPEN' ? <ContestCard key={c.id} contest={c} /> : <ContestRow key={c.id} contest={c} />))}
      </ScrollView>
    </View>
  )
}

/** The open contest, as board A draws its "Weekly Contest" card; Home shows it too. */
export function ContestCard({ contest: c }: { contest: Item }) {
  const done = c.viewerAttempt?.finished
  return (
    <View className="gap-3 rounded-3xl p-5" style={{ backgroundColor: '#1C1A3A' }}>
      <View className="flex-row items-start gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-xs font-semibold uppercase" style={{ color: '#c7c3f5' }}>
            Weekly contest
          </Text>
          <Text className="text-xl font-extrabold" style={{ color: '#ffffff' }}>
            {c.title}
          </Text>
          <Text className="text-sm" style={{ color: '#e5e3ff' }}>
            {c.subjectTitle ? `Test yourself on ${c.subjectTitle}.` : 'Test yourself.'}
          </Text>
        </View>
        <Trophy size={44} color="#fcd34d" />
      </View>
      <Text className="text-sm" style={{ color: '#e5e3ff' }}>
        {[`${c.questionCount} questions`, `${c.minutes} minutes`, c.participantsMilestone ? `${c.participantsMilestone.toLocaleString('en-IN')}+ taking part` : null].filter(Boolean).join(' · ')}
      </Text>
      <Pressable accessibilityRole="link" onPress={() => router.push(`/contests/${c.id}`)} className="bg-primary items-center rounded-xl py-3">
        <Text className="text-primary-foreground font-semibold">{done ? 'See your answers' : c.viewerAttempt ? 'Continue' : 'Join now'}</Text>
      </Pressable>
    </View>
  )
}

function ContestRow({ contest: c }: { contest: Item }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={c.title} onPress={() => router.push(`/contests/${c.id}`)} className="bg-card border-border flex-row items-center gap-3 rounded-2xl border p-4">
      <View className="flex-1 gap-0.5">
        <Text className="font-semibold">{c.title}</Text>
        <Text className="text-muted-foreground text-sm">{c.state === 'UPCOMING' ? `Opens ${when(c.opensAt)}` : `Closed ${new Date(c.closesAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}</Text>
      </View>
      {c.viewerAttempt?.finished ? <Text className="text-sm font-semibold">{`${c.viewerAttempt.score ?? 0} of ${c.viewerAttempt.total}`}</Text> : null}
      <Text className="text-muted-foreground text-xs font-semibold">{STATE[c.state]}</Text>
    </Pressable>
  )
}
