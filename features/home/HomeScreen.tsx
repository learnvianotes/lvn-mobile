import type { ReactNode } from 'react'
import { ScrollView, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Text } from '@/components/ui/text'
import { ContinueCard } from './ContinueCard'
import { ExamReadiness } from './ExamReadiness'
import { HeroCard } from './HeroCard'
import { HomeHeader } from './HomeHeader'
import { learner } from './mock'
import { QuickActions } from './QuickActions'
import { Recommended } from './Recommended'
import { RhythmCard } from './RhythmCard'
import { SubjectChips } from './SubjectChips'

/** Sections rise in quickly and in order (40 ms apart); Reanimated skips this when the system asks for reduced motion. */
function Section({ index, title, action, children }: { index: number; title?: string; action?: string; children: ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.duration(260).delay(index * 40)} className="gap-3">
      {title ? (
        <View className="flex-row items-end justify-between">
          <Text className="text-lg font-bold" accessibilityRole="header">{title}</Text>
          {action ? <Text className="text-primary text-sm font-medium">{action}</Text> : null}
        </View>
      ) : null}
      {children}
    </Animated.View>
  )
}

/** PROTOTYPE (prototype/home-screen): the Home tab from the LearnViaNotes UI board, with Rhythm (ADR-0030). */
export function HomeScreen() {
  return (
    <SafeAreaView edges={['top']} className="bg-background flex-1">
      <ScrollView contentContainerClassName="gap-6 px-5 pb-32 pt-2" showsVerticalScrollIndicator={false}>
        <Section index={0}>
          <HomeHeader />
        </Section>
        <Section index={1}>
          <HeroCard firstName={learner.firstName} />
        </Section>
        <Section index={2}>
          <QuickActions />
        </Section>
        <Section index={3} title="Your rhythm" action="This week">
          <RhythmCard />
          <ExamReadiness />
        </Section>
        <Section index={4} title="Continue learning">
          <ContinueCard />
        </Section>
        <Section index={5} title="Recommended for you" action="See all">
          <SubjectChips />
          <Recommended />
        </Section>
      </ScrollView>
    </SafeAreaView>
  )
}
