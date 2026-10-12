import { useMutation } from '@apollo/client/react'
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { attempt } from '@/features/groups/shared'
import { ReactDocument, type ReactionKind, type ReactionsFieldsFragment, type ReactionTargetType } from '@/graphql/generated/graphql'

const KINDS: { kind: ReactionKind; emoji: string; label: string }[] = [
  { kind: 'LIKE', emoji: '👍', label: 'Like' },
  { kind: 'HELPFUL', emoji: '💡', label: 'Helpful' },
  { kind: 'CELEBRATE', emoji: '🎉', label: 'Celebrate' },
]

/** Three reactions, one per person (lvn-backend ADR-0047); on a public note others see milestones (ADR-0027). */
export function ReactionBar({ target, reactions, disabled, onChanged }: { target: { type: ReactionTargetType; id: string }; reactions: ReactionsFieldsFragment; disabled?: boolean; onChanged: () => void }) {
  const [react] = useMutation(ReactDocument)
  const [error, setError] = useState<string | null>(null)
  const press = async (kind: ReactionKind) => {
    setError(await attempt(() => react({ variables: { target, kind: reactions.viewerReaction === kind ? null : kind } })))
    onChanged()
  }
  return (
    <View className="flex-row flex-wrap items-center gap-2">
      {KINDS.map(({ kind, emoji, label }) => {
        const c = reactions.counts.find((x) => x.kind === kind)
        const mine = reactions.viewerReaction === kind
        const number = c?.count ? (c.atLeast ? `${c.count.toLocaleString('en-IN')}+` : String(c.count)) : ''
        return (
          <Pressable key={kind} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: mine, disabled: !!disabled }} disabled={disabled} onPress={() => void press(kind)} className={`flex-row items-center gap-1 rounded-full border px-2.5 py-1 ${mine ? 'border-primary bg-secondary' : 'border-border'} ${disabled ? 'opacity-50' : ''}`}>
            <Text>{emoji}</Text>
            {number ? <Text className="text-muted-foreground text-xs">{number}</Text> : null}
          </Pressable>
        )
      })}
      {error ? (
        <Text accessibilityRole="alert" className="text-destructive text-xs">
          {error}
        </Text>
      ) : null}
    </View>
  )
}
