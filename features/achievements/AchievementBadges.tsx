import { Brain, CalendarCheck, ClipboardCheck, HandHeart, Target, type LucideIcon } from 'lucide-react-native'
import { View } from 'react-native'
import { Text } from '@/components/ui/text'

export type AchievementKindName = 'TOPICS_MASTERED' | 'QUIZ_MASTER' | 'EXAM_READY' | 'RHYTHM_WEEKS' | 'SUBJECT_CONTRIBUTOR'

export interface Badge {
  id: string
  kind: AchievementKindName
  title: string
  description: string
}

/** Each kind's icon and tint, as board A draws the Profile's achievement row. */
const LOOK: Record<AchievementKindName, { icon: LucideIcon; bg: string; fg: string }> = {
  TOPICS_MASTERED: { icon: Brain, bg: '#ccfbf1', fg: '#0f766e' },
  QUIZ_MASTER: { icon: Target, bg: '#fef3c7', fg: '#b45309' },
  EXAM_READY: { icon: ClipboardCheck, bg: '#e0f2fe', fg: '#0369a1' },
  RHYTHM_WEEKS: { icon: CalendarCheck, bg: '#ffedd5', fg: '#c2410c' },
  SUBJECT_CONTRIBUTOR: { icon: HandHeart, bg: '#e6f4f6', fg: '#0f5f6b' },
}

/**
 * Achievements as board A draws them (lvn-backend ADR-0080): a tinted circle per kind with its name under it; screen
 * readers hear what it means. `wrap` lays them in rows of four for the Achievements screen.
 */
export function AchievementBadges({ items, wrap = false }: { items: Badge[]; wrap?: boolean }) {
  return (
    <View className={wrap ? 'flex-row flex-wrap gap-y-4' : 'flex-row'}>
      {items.map((a) => {
        const { icon: Icon, bg, fg } = LOOK[a.kind]
        return (
          <View key={a.id} accessible accessibilityLabel={`${a.title}. ${a.description}`} className="w-1/4 items-center gap-1.5 px-1">
            <View className="size-14 items-center justify-center rounded-full" style={{ backgroundColor: bg }}>
              <Icon size={26} color={fg} />
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
