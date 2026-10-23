import { router } from 'expo-router'
import { BookOpen, CalendarClock, ListChecks, RotateCcw, TrendingUp, Library } from 'lucide-react-native'
import { ScrollView, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { PressScale } from '@/features/shell/PressScale'
import type { RecommendationKind, RecommendationsQuery } from '@/graphql/generated/graphql'
import { coreName, recommendationHref } from '@/features/learning/recommendationHref'
import { useTheme } from '@/lib/theme'

type Rec = RecommendationsQuery['recommendations'][number]
const ICONS: Record<RecommendationKind, typeof BookOpen> = { EXAM_TOPIC: CalendarClock, REVISE_TOPIC: RotateCcw, CONTINUE_NOTE: BookOpen, QUIZ_ON_TOPIC: ListChecks, POPULAR_NOTE: TrendingUp, RESOURCE: Library }
const TONE: Record<RecommendationKind, 'brand' | 'info' | 'warning'> = {
  EXAM_TOPIC: 'warning',
  REVISE_TOPIC: 'brand',
  CONTINUE_NOTE: 'brand',
  QUIZ_ON_TOPIC: 'info',
  POPULAR_NOTE: 'info',
  RESOURCE: 'warning',
}

/** Recommendations always say why (§14.3, lvn-backend ADR-0071). */
export function Recommended({ items }: { items: Rec[] }) {
  const { palette, scheme } = useTheme()
  if (!items.length) return <Text className="text-muted-foreground text-sm">Read a few notes, add an exam or take a quiz, and suggestions appear here.</Text>
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }} style={{ marginHorizontal: -20 }}>
      {items.map((r) => {
        const Icon = ICONS[r.kind]
        const title = r.resource?.title || r.noteTitle || r.topicTitle || (r.topicKey ? coreName(r.topicKey) : 'Untitled')
        const fill = palette[TONE[r.kind]]
        const glyph = scheme === 'dark' ? palette.inverse : '#ffffff'
        return (
          <PressScale key={`${r.kind}:${r.resource?.id ?? r.note?.id ?? r.topicKey}`} accessibilityRole="button" accessibilityLabel={`${title}. ${r.reason}`} onPress={() => router.push(recommendationHref(r))}>
            <View className="bg-card border-border w-44 overflow-hidden rounded-2xl border">
              <View style={{ height: 88, alignItems: 'center', justifyContent: 'center', backgroundColor: fill }}>
                <Icon size={34} color={glyph} />
              </View>
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
