import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { BookOpen, CalendarClock, ListChecks, RotateCcw, TrendingUp, Library } from 'lucide-react-native'
import { ScrollView, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { PressScale } from '@/features/shell/PressScale'
import type { RecommendationKind, RecommendationsQuery } from '@/graphql/generated/graphql'
import { coreName, recommendationHref } from '@/features/learning/recommendationHref'

type Rec = RecommendationsQuery['recommendations'][number]
const ICONS: Record<RecommendationKind, typeof BookOpen> = { EXAM_TOPIC: CalendarClock, REVISE_TOPIC: RotateCcw, CONTINUE_NOTE: BookOpen, QUIZ_ON_TOPIC: ListChecks, POPULAR_NOTE: TrendingUp, RESOURCE: Library }
const TONES: Record<RecommendationKind, readonly [string, string]> = {
  EXAM_TOPIC: ['#ea580c', '#db2777'],
  REVISE_TOPIC: ['#2563eb', '#0891b2'],
  CONTINUE_NOTE: ['#0284c7', '#2563eb'],
  QUIZ_ON_TOPIC: ['#059669', '#0284c7'],
  POPULAR_NOTE: ['#0891b2', '#db2777'],
  RESOURCE: ['#0d9488', '#2563eb'],
}

/** Recommendations always say why (§14.3, lvn-backend ADR-0071). */
export function Recommended({ items }: { items: Rec[] }) {
  if (!items.length) return <Text className="text-muted-foreground text-sm">Read a few notes, add an exam or take a quiz, and suggestions appear here.</Text>
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }} style={{ marginHorizontal: -20 }}>
      {items.map((r) => {
        const Icon = ICONS[r.kind]
        const title = r.resource?.title || r.noteTitle || r.topicTitle || (r.topicKey ? coreName(r.topicKey) : 'Untitled')
        return (
          <PressScale key={`${r.kind}:${r.resource?.id ?? r.note?.id ?? r.topicKey}`} accessibilityRole="button" accessibilityLabel={`${title}. ${r.reason}`} onPress={() => router.push(recommendationHref(r))}>
            <View className="bg-card border-border w-44 overflow-hidden rounded-3xl border">
              <LinearGradient colors={[...TONES[r.kind]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 88, alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={34} color="#ffffff" />
              </LinearGradient>
              <View className="gap-1 p-3">
                <Text className="font-semibold" numberOfLines={1}>
                  {title}
                </Text>
                <Text className="text-primary text-xs" numberOfLines={3}>
                  {r.reason}
                </Text>
              </View>
            </View>
          </PressScale>
        )
      })}
    </ScrollView>
  )
}
