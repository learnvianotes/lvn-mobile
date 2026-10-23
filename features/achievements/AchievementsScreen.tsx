import { useMutation, useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { ArrowLeft, Award } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, ScrollView, Switch, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { LoadState } from '@/features/shell/LoadState'
import { MyAchievementsDocument, MyPointsDocument, SetAchievementsShownDocument } from '@/graphql/generated/graphql'
import { AchievementBadges } from './AchievementBadges'

export const LEVEL = { NEWCOMER: 'Newcomer', CONTRIBUTOR: 'Contributor', TRUSTED: 'Trusted contributor' } as const
const LEVEL_FROM = { NEWCOMER: 0, CONTRIBUTOR: 50, TRUSTED: 250 } as const
const RULE: Record<string, [earned: string, back: string]> = {
  REACTION: ['A reaction on your note', 'A reaction taken back or the note no longer public'],
  FORK: ['Your note was forked', 'The note is no longer public'],
  RESOURCE_APPROVED: ['Your resource was approved', 'Your resource left the catalogue'],
}

/**
 * Achievements on the phone (lvn-backend ADR-0080): the level and how far the next is, what was earned, the points
 * history (each line opens what earned it) and, for an adult, showing them on the profile. The achievement
 * notification opens here.
 */
export function AchievementsScreen() {
  const insets = useSafeAreaInsets()
  const fg = String(useCSSVariable('--color-foreground') ?? '#152033')
  const primary = String(useCSSVariable('--color-primary') ?? '#1e4d8c')
  const mine = useQuery(MyAchievementsDocument, { fetchPolicy: 'cache-and-network' })
  const points = useQuery(MyPointsDocument, { variables: { first: 30 }, fetchPolicy: 'cache-and-network' })
  const viewer = mine.data?.viewer
  const items = viewer?.achievements ?? []
  const c = viewer?.contribution
  const entries = points.data?.myPoints.edges.map((e) => e.node) ?? []
  const page = points.data?.myPoints.pageInfo
  return (
    <View className="bg-background flex-1">
      <View className="flex-row items-center gap-2 px-3 pb-2" style={{ paddingTop: insets.top + 6 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/profile'))} className="size-10 items-center justify-center rounded-full">
          <ArrowLeft size={22} color={fg} />
        </Pressable>
        <Text className="text-lg font-bold" accessibilityRole="header">
          Achievements
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 32 }}>
        <Text className="text-muted-foreground text-sm">What you have learned, and what others did with what you made public. Only you see this unless you show it.</Text>
        <LoadState query={mine} message="Your achievements could not load." />
        {c ? (
          <View className="bg-card border-border gap-3 rounded-3xl border p-4">
            <View className="flex-row items-center gap-3">
              <View className="bg-secondary size-12 items-center justify-center rounded-full">
                <Award size={24} color={primary} />
              </View>
              <View className="flex-1">
                <Text className="text-lg font-bold" accessibilityRole="header">
                  {LEVEL[c.level]}
                </Text>
                <Text className="text-muted-foreground text-sm">{c.points === 1 ? '1 point' : `${c.points} points`}</Text>
              </View>
            </View>
            {c.nextLevelAt ? (
              <View className="gap-1">
                <View className="bg-muted h-2 overflow-hidden rounded-full" accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(((c.points - LEVEL_FROM[c.level]) / (c.nextLevelAt - LEVEL_FROM[c.level])) * 100) }}>
                  <View className="bg-primary h-full rounded-full" style={{ width: `${Math.round(((c.points - LEVEL_FROM[c.level]) / (c.nextLevelAt - LEVEL_FROM[c.level])) * 100)}%` }} />
                </View>
                <Text className="text-muted-foreground text-xs">{c.nextLevelAt - c.points === 1 ? '1 more point' : `${c.nextLevelAt - c.points} more points`} to the next level</Text>
              </View>
            ) : null}
            <Text className="text-muted-foreground text-sm">Points come from what others do with your public work: a reaction on a note (+1), a fork (+5), a resource moderators approve (+10).</Text>
          </View>
        ) : null}

        <Text className="text-base font-bold" accessibilityRole="header">
          Earned
        </Text>
        {items.length ? (
          <AchievementBadges items={items} wrap />
        ) : mine.data ? (
          <View className="border-border gap-2 rounded-2xl border border-dashed p-4">
            <Text className="text-muted-foreground text-center text-sm">Nothing yet. Achievements mark what you learn: master a topic, get an exam ready, meet your Rhythm weeks.</Text>
            <View className="flex-row justify-center gap-4">
              <Pressable accessibilityRole="link" onPress={() => router.push('/review')}>
                <Text className="text-primary text-sm font-semibold">Review cards</Text>
              </Pressable>
              <Pressable accessibilityRole="link" onPress={() => router.push('/exams')}>
                <Text className="text-primary text-sm font-semibold">Plan an exam</Text>
              </Pressable>
              <Pressable accessibilityRole="link" onPress={() => router.push('/rhythm')}>
                <Text className="text-primary text-sm font-semibold">Your Rhythm</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {mine.data ? <Visibility key={String(mine.data.achievementSettings.showAchievements)} shown={mine.data.achievementSettings.showAchievements} canShow={mine.data.achievementSettings.canShow} /> : null}

        <Text className="text-base font-bold" accessibilityRole="header">
          Points history
        </Text>
        <LoadState query={points} inline message="Your points history could not load." />
        {points.data && !entries.length ? <Text className="text-muted-foreground text-sm">No points yet. Make a note public: reactions and forks on it earn points.</Text> : null}
        {entries.length ? (
          <View className="bg-card border-border rounded-2xl border">
            {entries.map((e, i) => (
              <Pressable
                key={e.id}
                accessibilityRole="link"
                onPress={() => router.push(e.sourceType === 'NOTE' ? `/notes/${e.sourceId}` : `/resources/${e.sourceId}`)}
                className={`flex-row items-center gap-3 px-4 py-3 ${i ? 'border-border border-t' : ''}`}
              >
                <Text className={`w-10 font-bold ${e.delta > 0 ? 'text-success' : 'text-muted-foreground'}`}>{e.delta > 0 ? `+${e.delta}` : String(e.delta)}</Text>
                <Text className="flex-1 text-sm" numberOfLines={2}>
                  {RULE[e.rule]?.[e.delta < 0 ? 1 : 0] ?? e.rule}
                  {e.subjectTitle ? <Text className="text-muted-foreground"> · {e.subjectTitle}</Text> : null}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {page?.hasNextPage ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void points.fetchMore({ variables: { after: page.endCursor }, updateQuery: (prev, { fetchMoreResult }) => ({ myPoints: { ...fetchMoreResult.myPoints, edges: [...prev.myPoints.edges, ...fetchMoreResult.myPoints.edges] } }) })}
            className="self-start"
          >
            <Text className="text-primary font-semibold">Show more</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  )
}

function Visibility({ shown, canShow }: { shown: boolean; canShow: boolean }) {
  const [on, setOn] = useState(shown)
  const [set, setting] = useMutation(SetAchievementsShownDocument, { refetchQueries: [MyAchievementsDocument] })
  if (!canShow) return <Text className="text-muted-foreground text-sm">Your achievements stay private until you are 18: only you see them.</Text>
  return (
    <View className="flex-row items-center gap-3">
      <View className="flex-1 gap-0.5">
        <Text className="font-semibold">Show on my profile</Text>
        <Text className="text-muted-foreground text-sm">Anyone who opens your profile sees your achievements and level. Your points history stays yours.</Text>
      </View>
      <Switch
        accessibilityLabel="Show my achievements and level on my profile"
        value={on}
        disabled={setting.loading}
        onValueChange={async (next) => {
          setOn(next)
          const res = await set({ variables: { show: next } }).catch(() => null)
          if (!res?.data?.setAchievementsShown.settings) setOn(!next)
        }}
      />
    </View>
  )
}
