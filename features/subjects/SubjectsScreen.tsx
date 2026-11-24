import { useQuery } from '@apollo/client/react'
import { router, useLocalSearchParams } from 'expo-router'
import { BookOpen, ChevronRight } from 'lucide-react-native'
import { Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { ScreenHeader } from '@/features/shell/Form'
import { LoadFailed, Loading } from '@/features/shell/LoadState'
import { SubjectsDocument } from '@/graphql/generated/graphql'

const LEAD = 'The subjects and topics notes on LearnViaNotes are organised by. Each topic gathers the public notes and resources people share on it.'

/** A topic's notes, in Explore. */
const openTopic = (t: { id: string; title: string }) => router.push({ pathname: '/explore', params: { topic: t.id, topicTitle: t.title } })

/**
 * Subjects. A failed catalogue is not a 404: the page keeps its heading and says the list could not load.
 * A slug that is absent from a successful catalogue is a real miss.
 */
export function SubjectsScreen() {
  const insets = useSafeAreaInsets()
  const accent = String(useCSSVariable('--color-primary') ?? '#2847a8')
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#66625b')
  const { slug } = useLocalSearchParams<{ slug?: string }>()
  const query = useQuery(SubjectsDocument, { fetchPolicy: 'cache-and-network' })
  const { data, error, refetch } = query
  const subjects = data?.subjects ?? []
  const subject = slug ? subjects.find((s) => s.slug === slug) : null
  const missing = Boolean(slug && data && !subject)
  return (
    <View className="bg-background flex-1">
      <ScreenHeader title={subject?.title ?? (missing ? 'Page not found' : 'Subjects')} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 32 }}>
        {!slug && !missing ? <Text className="text-muted-foreground text-base leading-6">{LEAD}</Text> : null}
        {!data && !error ? <Loading /> : null}
        {!data && error ? <LoadFailed message="Subjects could not load just now. Try again in a moment." onRetry={() => void refetch()} /> : null}
        {missing ? (
          <View className="gap-3 py-6">
            <Text className="text-2xl font-semibold" accessibilityRole="header">Page not found.</Text>
            <Text className="text-muted-foreground">This page does not exist or is no longer public.</Text>
            <Pressable accessibilityRole="link" accessibilityLabel="Go home" onPress={() => router.replace('/')} className="min-h-11 justify-center">
              <Text className="text-primary font-semibold">Go home</Text>
            </Pressable>
          </View>
        ) : null}
        {!slug
          ? subjects.map((s) => (
              <Pressable key={s.id} accessibilityRole="link" accessibilityLabel={s.title} onPress={() => router.push(`/subjects/${s.slug}`)} className="bg-card border-border min-h-11 flex-row items-center gap-3 rounded-2xl border p-4">
                <BookOpen size={18} color={accent} />
                <View className="flex-1">
                  <Text className="font-semibold">{s.title}</Text>
                  <Text className="text-muted-foreground text-xs">{s.topics.length === 1 ? '1 topic' : `${s.topics.length} topics`}</Text>
                </View>
                <ChevronRight size={18} color={muted} />
              </Pressable>
            ))
          : null}
        {data && !slug && subjects.length === 0 ? (
          <View className="border-border items-center rounded-3xl border border-dashed px-6 py-10">
            <Text className="text-muted-foreground text-center text-sm">No subjects are published yet.</Text>
          </View>
        ) : null}
        {subject ? (
          <View className="gap-3">
            <Text className="text-muted-foreground text-sm">Subjects › {subject.title}</Text>
            <Text className="text-lg font-semibold" accessibilityRole="header">Topics</Text>
            {subject.topics.map((t) => (
              <View key={t.id} className="bg-card border-border gap-2 rounded-2xl border p-4">
                <Pressable accessibilityRole="link" accessibilityLabel={`Notes on ${t.title}`} onPress={() => openTopic(t)} className="min-h-10 justify-center">
                  <Text className="font-semibold">{t.title}</Text>
                </Pressable>
                {t.children.length ? (
                  <View className="flex-row flex-wrap gap-1.5">
                    {t.children.map((c) => (
                      <Pressable key={c.id} accessibilityRole="link" accessibilityLabel={`Notes on ${c.title}`} onPress={() => openTopic(c)} className="bg-secondary min-h-10 justify-center rounded-full px-3">
                        <Text className="text-primary text-xs font-semibold">{c.title}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}
