import { Brain, CalendarCheck, ClipboardCheck, HandHeart, Target, type LucideIcon } from 'lucide-react-native'
import { View } from 'react-native'
import { Text } from '@/components/ui/text'
import { resolvePalette, useTheme } from '@/lib/theme'

export type AchievementKindName = 'TOPICS_MASTERED' | 'QUIZ_MASTER' | 'EXAM_READY' | 'RHYTHM_WEEKS' | 'SUBJECT_CONTRIBUTOR'

export interface Badge {
  id: string
  kind: AchievementKindName
  title: string
  description: string
}

/** Each kind's icon, tinted with one accent from tokens.json. */
const LOOK: Record<AchievementKindName, { icon: LucideIcon; accent: string }> = {
  TOPICS_MASTERED: { icon: Brain, accent: 'teal' },
  QUIZ_MASTER: { icon: Target, accent: 'amber' },
  EXAM_READY: { icon: ClipboardCheck, accent: 'navy' },
  RHYTHM_WEEKS: { icon: CalendarCheck, accent: 'forest' },
  SUBJECT_CONTRIBUTOR: { icon: HandHeart, accent: 'slate' },
}

/**
 * Achievements as board A draws them (lvn-backend ADR-0080): a tinted circle per kind with its name under it; screen
 * readers hear what it means. `wrap` lays them in rows of four for the Achievements screen.
 */
export function AchievementBadges({ items, wrap = false }: { items: Badge[]; wrap?: boolean }) {
  const { scheme } = useTheme()
  return (
    <View className={wrap ? 'flex-row flex-wrap gap-y-4' : 'flex-row'}>
      {items.map((a) => {
        const { icon: Icon, accent } = LOOK[a.kind]
        const tone = resolvePalette(scheme, accent)
        return (
          <View key={a.id} accessible accessibilityLabel={`${a.title}. ${a.description}`} className="w-1/4 items-center gap-1.5 px-1">
            <View className="size-14 items-center justify-center rounded-full" style={{ backgroundColor: tone.brandSoft }}>
              <Icon size={26} color={tone.brand} />
            </View>
            <Text className="text-center text-xs font-semibold" numberOfLines={2}>
              {a.title}
            </Text>
          </View>
        )
      })}
    </View>
  )
}
