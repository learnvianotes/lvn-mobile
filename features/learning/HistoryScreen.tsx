import { useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { LoadState } from '@/features/shell/LoadState'
import { LearningHistoryDocument, type LearningHistoryQuery } from '@/graphql/generated/graphql'

type Day = LearningHistoryQuery['learningHistory']['days'][number]

const minutes = (seconds: number) => Math.round(seconds / 60)
const coreName = (key: string) => key.replace(/^core:/, '').replace('/', ' / ').replace(/-/g, ' ')
const dateLabel = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

/**
 * Learning history on the phone (lvn-backend ADR-0067): the same days as the web, newest first, in the person's time
 * zone. Days that count for Rhythm say so; the others are just days.
 */
export function HistoryScreen() {
  const insets = useSafeAreaInsets()
  const fg = String(useCSSVariable('--color-foreground') ?? '#111827')
  const days = useQuery(LearningHistoryDocument, { variables: { days: 14 }, fetchPolicy: 'cache-and-network' })
  const { fetchMore } = days
  const history = days.data?.learningHistory
  const more = () =>
    history?.nextBefore &&
    void fetchMore({
      variables: { before: history.nextBefore, days: 14 },
      updateQuery: (prev, { fetchMoreResult }) => ({ learningHistory: { ...fetchMoreResult.learningHistory, days: [...prev.learningHistory.days, ...fetchMoreResult.learningHistory.days] } }),
    })
  return (
    <View className="bg-background flex-1">
      <View className="flex-row items-center gap-2 px-3 pb-2" style={{ paddingTop: insets.top + 6 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} className="rounded-full p-2">
          <ArrowLeft size={22} color={fg} />
        </Pressable>
        <Text className="text-lg font-bold" accessibilityRole="header">
          Learning history
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 32 }}>
        {history ? <Text className="text-muted-foreground text-sm">Days are counted in {history.timeZone} and start at 4 in the morning.</Text> : null}
        <LoadState query={days} message="Your history could not load. Check your connection." />
        {history && !history.days.length ? <Text className="text-muted-foreground text-center">Nothing here yet. Read a note, review some cards or take a quiz, and your days show up here.</Text> : null}
        {history?.days.map((d) => <DayCard key={d.day} day={d} />)}
        {history?.nextBefore ? (
          <Pressable accessibilityRole="button" onPress={more} className="border-border items-center rounded-xl border py-3">
            <Text className="font-semibold">Older days</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  )
}

function DayCard({ day: d }: { day: Day }) {
  const stats = [
    d.learningSeconds >= 60 ? `Learning ${minutes(d.learningSeconds)} min` : null,
    d.readingSeconds >= 60 ? `Reading ${minutes(d.readingSeconds)} min` : null,
    d.reviews ? `${d.reviews} ${d.reviews === 1 ? 'card' : 'cards'} reviewed` : null,
    d.quizAnswers ? `${d.quizAnswers} quiz ${d.quizAnswers === 1 ? 'answer' : 'answers'}` : null,
  ].filter(Boolean)
  const notes = d.notes.filter((n): n is NonNullable<typeof n> => !!n)
  return (
    <View accessibilityLabel={dateLabel(d.day)} className="bg-card border-border gap-2 rounded-2xl border p-4">
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className="font-semibold">{dateLabel(d.day)}</Text>
        {d.counted ? <Text className="bg-secondary text-primary rounded-full px-2 py-0.5 text-xs font-medium">Counts for your Rhythm</Text> : null}
      </View>
      <Text className="text-muted-foreground text-sm">{stats.length ? stats.join(' · ') : 'Notes made or shared'}</Text>
      {d.topics.length ? (
        <View className="flex-row flex-wrap gap-2">
          {d.topics.slice(0, 8).map((t) => (
            <Text key={t.key} className="bg-secondary rounded-full px-3 py-1 text-xs">
              {t.topic?.title ?? (t.key.startsWith('core:') ? coreName(t.key) : 'A topic')}
              {t.seconds >= 60 ? ` · ${minutes(t.seconds)} min` : ''}
            </Text>
          ))}
        </View>
      ) : null}
      {notes.map((n) => (
        <Pressable key={n.id} accessibilityRole="link" onPress={() => router.push(`/notes/${n.id}`)}>
          <Text className="text-primary text-sm">{n.title || 'Untitled'}</Text>
        </Pressable>
      ))}
    </View>
  )
}
