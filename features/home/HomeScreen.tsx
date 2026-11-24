import { useApolloClient, useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { useState, type ReactNode } from 'react'
import { Pressable, RefreshControl, ScrollView, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from '@/components/ui/safe-area-view'
import { Text } from '@/components/ui/text'
import { ContinueCard } from './ContinueCard'
import { ExamReadiness } from './ExamReadiness'
import { HeroCard } from './HeroCard'
import { LoadState } from '@/features/shell/LoadState'
import { ContestsDocument, DailyLineDocument, ExamsDocument, RecommendationsDocument, RhythmDocument, UnreadNotificationCountDocument, ViewerDocument } from '@/graphql/generated/graphql'
import { VerifyEmailBanner } from '@/features/auth/VerifyEmailBanner'
import { HomeHeader } from './HomeHeader'
import { QuickActions } from './QuickActions'
import { Recommended } from './Recommended'
import { RhythmCard } from './RhythmCard'
import { ContestCard } from '@/features/contests/ContestsScreen'

/** Sections rise in quickly and in order (40 ms apart); Reanimated skips this when the system asks for reduced motion. */
function Section({ index, title, action, onAction, children }: { index: number; title?: string; action?: string; onAction?: () => void; children: ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.duration(260).delay(index * 40)} className="gap-3">
      {title ? (
        <View className="flex-row items-end justify-between">
          <Text className="flex-1 text-lg font-semibold" accessibilityRole="header">{title}</Text>
          {action ? (
            <Pressable accessibilityRole="link" disabled={!onAction} onPress={onAction}>
              <Text className="text-primary text-sm font-medium">{action}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {children}
    </Animated.View>
  )
}

/** What Home shows, asked again when the person pulls it down. */
const HOME_QUERIES = [ViewerDocument, DailyLineDocument, UnreadNotificationCountDocument, RhythmDocument, ExamsDocument, ContestsDocument, RecommendationsDocument]

/**
 * The Home tab (lvn-backend ADR-0069–0071, P6h): a greeting, today's ring and this week's Rhythm, the next exam's
 * Readiness, the note to continue, and recommendations, each saying why. Pulling it down asks for all of it again.
 */
export function HomeScreen() {
  const client = useApolloClient()
  const [refreshing, setRefreshing] = useState(false)
  const viewer = useQuery(ViewerDocument).data?.viewer
  const recsQuery = useQuery(RecommendationsDocument, { variables: { limit: 8 }, fetchPolicy: 'cache-and-network' })
  const recs = recsQuery.data?.recommendations
  const firstName = viewer?.displayName.trim().split(/\s+/)[0] ?? ''
  const next = recs?.find((r) => r.kind === 'CONTINUE_NOTE')
  const others = recs?.filter((r) => r !== next) ?? []
  return (
    <SafeAreaView edges={['top']} className="bg-background flex-1">
      <ScrollView
        contentContainerClassName="gap-6 px-5 pb-32 pt-2"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              void client
                .refetchQueries({ include: HOME_QUERIES })
                .catch(() => undefined)
                .finally(() => setRefreshing(false))
            }}
          />
        }
      >
        <Section index={0}>
          <HomeHeader />
        </Section>
        <VerifyEmailBanner />
        <Section index={1}>
          <HeroCard firstName={firstName} />
        </Section>
        <Section index={2}>
          <QuickActions />
        </Section>
        <Section index={3} title="Your rhythm" action="This week" onAction={() => router.push('/rhythm')}>
          <RhythmCard />
          <ExamReadiness />
        </Section>
        <OpenContest />
        {next ? (
          <Section index={4} title="Continue learning">
            <ContinueCard item={next} />
          </Section>
        ) : null}
        <Section index={5} title="Recommended for you" action="See all" onAction={() => router.push('/rhythm')}>
          {recs ? <Recommended items={others} /> : <LoadState query={recsQuery} inline message="Recommendations could not load." />}
        </Section>
      </ScrollView>
    </SafeAreaView>
  )
}

/** Board A's weekly contest card, while one is open (lvn-backend ADR-0082); nothing otherwise. */
function OpenContest() {
  const open = useQuery(ContestsDocument, { fetchPolicy: 'cache-and-network' }).data?.contests.find((c) => c.state === 'OPEN')
  if (!open) return null
  return (
    <Section index={4} title="Weekly contest" action="All contests" onAction={() => router.push('/contests')}>
      <ContestCard contest={open} />
    </Section>
  )
}

