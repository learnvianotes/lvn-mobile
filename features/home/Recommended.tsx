import { LinearGradient } from 'expo-linear-gradient'
import { router, type Href } from 'expo-router'
import { BookOpen, CalendarClock, ListChecks, RotateCcw, TrendingUp, Library } from 'lucide-react-native'
import { ScrollView, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { PressScale } from '@/features/shell/PressScale'
import type { RecommendationKind, RecommendationsQuery } from '@/graphql/generated/graphql'

type Rec = RecommendationsQuery['recommendations'][number]
const ICONS: Record<RecommendationKind, typeof BookOpen> = { EXAM_TOPIC: CalendarClock, REVISE_TOPIC: RotateCcw, CONTINUE_NOTE: BookOpen, QUIZ_ON_TOPIC: ListChecks, POPULAR_NOTE: TrendingUp, RESOURCE: Library }
const TONES: Record<RecommendationKind, readonly [string, string]> = {
  EXAM_TOPIC: ['#ea580c', '#db2777'],
  REVISE_TOPIC: ['#4f46e5', '#7c3aed'],
  CONTINUE_NOTE: ['#0284c7', '#4f46e5'],
  QUIZ_ON_TOPIC: ['#059669', '#0284c7'],
  POPULAR_NOTE: ['#7c3aed', '#db2777'],
  RESOURCE: ['#0d9488', '#4f46e5'],
}
const coreName = (key: string) => key.replace(/^core:/, '').replace('/', ' / ').replace(/-/g, ' ')
const hrefOf = (r: Rec): Href | null => (r.note ? `/notes/${r.note.id}` : r.resource ? `/resources/${r.resource.id}` : r.kind === 'EXAM_TOPIC' ? '/exams' : null)

/** Recommendations always say why (§14.3, lvn-backend ADR-0071). */
export function Recommended({ items }: { items: Rec[] }) {
  if (!items.length) return <Text className="text-muted-foreground text-sm">Read a few notes, add an exam or take a quiz, and suggestions appear here.</Text>
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }} style={{ marginHorizontal: -20 }}>
      {items.map((r) => {
        const Icon = ICONS[r.kind]
        const title = r.resource?.title || r.noteTitle || r.topicTitle || (r.topicKey ? coreName(r.topicKey) : 'Untitled')
        const href = hrefOf(r)
        return (
          <PressScale key={`${r.kind}:${r.resource?.id ?? r.note?.id ?? r.topicKey}`} accessibilityRole="button" accessibilityLabel={`${title}. ${r.reason}`} onPress={() => href && router.push(href)}>
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
