import { useQuery } from '@apollo/client/react'
import { router, useLocalSearchParams } from 'expo-router'
import { BookOpen, ChevronRight } from 'lucide-react-native'
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { ScreenHeader } from '@/features/shell/Form'
import { SubjectsDocument } from '@/graphql/generated/graphql'

/** A topic's notes, in Explore. */
const openTopic = (t: { id: string; title: string }) => router.push({ pathname: '/explore', params: { topic: t.id, topicTitle: t.title } })

/**
 * Subjects on the phone (owner, 2026-10-14): the app's own catalogue of subjects and topics, not the old /core notes.
 * Without a subject, the list of subjects; with one, its topics and subtopics, each opening its notes in Explore.
 */
export function SubjectsScreen() {
  const insets = useSafeAreaInsets()
  const accent = String(useCSSVariable('--color-primary') ?? '#2563eb')
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  const { slug } = useLocalSearchParams<{ slug?: string }>()
  const { data, loading, error } = useQuery(SubjectsDocument, { fetchPolicy: 'cache-and-network' })
  const subjects = data?.subjects ?? []
  const subject = slug ? subjects.find((s) => s.slug === slug) : null
  return (
    <View className="bg-background flex-1">
      <ScreenHeader title={subject?.title ?? 'Subjects'} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 32 }}>
        {!data && loading ? <ActivityIndicator /> : null}
        {!data && error ? <Text className="text-muted-foreground text-center">Subjects need the internet. Try again in a moment.</Text> : null}
        {slug && data && !subject ? <Text className="text-muted-foreground text-center">This subject is not here.</Text> : null}
        {!slug
          ? subjects.map((s) => (
              <Pressable key={s.id} accessibilityRole="link" accessibilityLabel={s.title} onPress={() => router.push(`/subjects/${s.slug}`)} className="bg-card border-border flex-row items-center gap-3 rounded-2xl border p-4">
                <BookOpen size={18} color={accent} />
                <View className="flex-1">
                  <Text className="font-semibold">{s.title}</Text>
                  <Text className="text-muted-foreground text-xs">{s.topics.length === 1 ? '1 topic' : `${s.topics.length} topics`}</Text>
                </View>
                <ChevronRight size={18} color={muted} />
              </Pressable>
            ))
          : null}
        {subject
          ? subject.topics.map((t) => (
              <View key={t.id} className="bg-card border-border gap-2 rounded-2xl border p-4">
                <Pressable accessibilityRole="link" accessibilityLabel={`Notes on ${t.title}`} onPress={() => openTopic(t)}>
                  <Text className="font-semibold">{t.title}</Text>
                </Pressable>
                {t.children.length ? (
                  <View className="flex-row flex-wrap gap-1.5">
                    {t.children.map((c) => (
                      <Pressable key={c.id} accessibilityRole="link" accessibilityLabel={`Notes on ${c.title}`} onPress={() => openTopic(c)} className="bg-secondary rounded-full px-2.5 py-1">
                        <Text className="text-primary text-xs font-semibold">{c.title}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            ))
          : null}
      </ScrollView>
    </View>
  )
}
