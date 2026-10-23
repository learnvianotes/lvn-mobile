import { MessageSquare } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { Discussion } from './Discussion'

/** Under a group post or class announcement: its comment count, opening its discussion (lvn-backend ADR-0047). */
export function PostComments({ type, id, count }: { type: 'GROUP_POST' | 'CLASSROOM_POST'; id: string; count: number }) {
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#3d4b63')
  const [open, setOpen] = useState(false)
  const label = open ? 'Hide comments' : count ? (count === 1 ? '1 comment' : `${count} comments`) : 'Comment'
  return (
    <View className="gap-3">
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} className="flex-row items-center gap-1.5 self-start">
        <MessageSquare size={14} color={muted} />
        <Text className="text-muted-foreground text-xs font-semibold">{label}</Text>
      </Pressable>
      {open ? <Discussion target={{ type, id }} compact /> : null}
    </View>
  )
}
