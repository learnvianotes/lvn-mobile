import { useMutation, useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { BookOpen, CalendarClock, ListChecks, RotateCcw, TrendingUp, X, Library } from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { LoadState } from '@/features/shell/LoadState'
import { DismissRecommendationDocument, RecommendationsDocument, type RecommendationKind, type RecommendationsQuery } from '@/graphql/generated/graphql'
import { haptic } from '@/lib/haptics'
import { coreName, recommendationHref } from './recommendationHref'

type Rec = RecommendationsQuery['recommendations'][number]

const ICONS: Record<RecommendationKind, typeof BookOpen> = { EXAM_TOPIC: CalendarClock, REVISE_TOPIC: RotateCcw, CONTINUE_NOTE: BookOpen, QUIZ_ON_TOPIC: ListChecks, POPULAR_NOTE: TrendingUp, RESOURCE: Library }

/**
 * Recommended for the viewer on the phone (lvn-backend ADR-0071): each with why, best first; one can be set aside for
 * 30 days. The API reads every note through the read rule when asked.
 */
export function Recommendations({ limit = 6 }: { limit?: number }) {
  const primary = String(useCSSVariable('--color-primary') ?? '#4f46e5')
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  const recs = useQuery(RecommendationsDocument, { variables: { limit }, fetchPolicy: 'cache-and-network' })
  const [dismiss] = useMutation(DismissRecommendationDocument, { refetchQueries: [RecommendationsDocument] })
  const items = recs.data?.recommendations
  if (!items) return <LoadState query={recs} inline message="Recommendations could not load." />
  return (
    <View className="bg-card border-border gap-3 rounded-2xl border p-4">
      <Text className="text-lg font-bold" accessibilityRole="header">
        Recommended for you
      </Text>
      {!items.length ? <Text className="text-muted-foreground text-sm">Nothing to recommend yet. Read a few notes, add an exam or take a quiz, and suggestions appear here.</Text> : null}
      {items.map((r) => {
        const Icon = ICONS[r.kind]
        const title = r.resource?.title || r.noteTitle || r.topicTitle || (r.topicKey ? coreName(r.topicKey) : 'Untitled')
        const entityId = r.resource?.id ?? r.note?.id ?? r.topicKey ?? ''
        return (
          <View key={`${r.kind}:${entityId}`} className="bg-muted flex-row items-start gap-3 rounded-xl px-3 py-2.5">
            <Icon size={20} color={primary} />
            <Pressable accessibilityRole="link" onPress={() => router.push(recommendationHref(r))} className="flex-1">
              <Text className="font-medium" numberOfLines={1}>
                {title}
              </Text>
              <Text className="text-muted-foreground text-sm">{r.reason}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Not now: ${title}`}
              onPress={() => {
                haptic.tick()
                void dismiss({ variables: { input: { kind: r.kind, entityId } } })
              }}
              className="rounded-full p-1"
            >
              <X size={16} color={muted} />
            </Pressable>
          </View>
        )
      })}
    </View>
  )
}
