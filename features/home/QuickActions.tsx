import { Camera, Mic, MessagesSquare, NotebookPen, Upload, type LucideIcon } from 'lucide-react-native'
import { View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { PressScale } from '@/features/shell/PressScale'

const ACTIONS: { label: string; icon: LucideIcon; bg: string; fg: string }[] = [
  { label: 'Notes', icon: NotebookPen, bg: 'bg-secondary', fg: '--color-primary' },
  { label: 'Q&A', icon: MessagesSquare, bg: 'bg-sky-soft', fg: '--color-sky' },
  { label: 'Camera', icon: Camera, bg: 'bg-rose-soft', fg: '--color-rose' },
  { label: 'Voice', icon: Mic, bg: 'bg-warm-soft', fg: '--color-warm' },
  { label: 'Upload', icon: Upload, bg: 'bg-success-soft', fg: '--color-success' },
]

/** Tinted icon tiles from the UI board. */
export function QuickActions() {
  const colors = useCSSVariable(ACTIONS.map((a) => a.fg)) as (string | undefined)[]
  return (
    <View className="flex-row justify-between">
      {ACTIONS.map(({ label, icon: Icon, bg }, i) => (
        <PressScale key={label} accessibilityRole="button" accessibilityLabel={label}>
          <View className="items-center gap-1.5">
            <View className={`${bg} size-14 items-center justify-center rounded-2xl`}>
              <Icon size={22} color={String(colors[i] ?? '#4f46e5')} />
            </View>
            <Text className="text-muted-foreground text-xs font-medium">{label}</Text>
          </View>
        </PressScale>
      ))}
    </View>
  )
}
