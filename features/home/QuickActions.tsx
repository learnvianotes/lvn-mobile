import { Camera, Mic, MessagesSquare, NotebookPen, Upload, type LucideIcon } from 'lucide-react-native'
import { router } from 'expo-router'
import { View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { useCreate, type CreateAction } from '@/features/shell/create'
import { PressScale } from '@/features/shell/PressScale'
import { UPLOAD_ACTIONS, useUploadsEnabled } from '@/features/notes/media/uploads'

/**
 * Tinted icon tiles from the UI board; each does what it says (lvn-backend ADR-0076): Notes opens the notes, Q&A asks
 * AI, Camera fills a tray of photos and PDFs that AI makes notes of, Voice records a voice note, Upload puts a file in a new note.
 */
const ACTIONS: { label: string; hint: string; icon: LucideIcon; bg: string; fg: string; go: string | CreateAction }[] = [
  { label: 'Notes', hint: 'Opens your notes', icon: NotebookPen, bg: 'bg-secondary', fg: '--color-primary', go: '/notes' },
  { label: 'Q&A', hint: 'Ask AI about your notes', icon: MessagesSquare, bg: 'bg-sky-soft', fg: '--color-sky', go: '/ask' },
  { label: 'Camera', hint: 'Take photos or add PDFs, and AI makes notes of them', icon: Camera, bg: 'bg-rose-soft', fg: '--color-rose', go: 'Photo' },
  { label: 'Voice', hint: 'Record a voice note', icon: Mic, bg: 'bg-warm-soft', fg: '--color-warm', go: 'Voice note' },
  { label: 'Upload', hint: 'Put a PDF, picture or recording in a new note', icon: Upload, bg: 'bg-success-soft', fg: '--color-success', go: 'Upload' },
]

export function QuickActions() {
  const colors = useCSSVariable(ACTIONS.map((a) => a.fg)) as (string | undefined)[]
  const create = useCreate()
  // Camera, Voice and Upload send files: only while uploads are on (lvn-backend ADR-0097).
  const uploadsOn = useUploadsEnabled()
  return (
    <View className="flex-row justify-between">
      {ACTIONS.map((action, i) => ({ ...action, i })).filter((a) => uploadsOn || !UPLOAD_ACTIONS.has(a.go)).map(({ label, hint, icon: Icon, bg, go, i }) => (
        <PressScale key={label} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} onPress={() => (go.startsWith('/') ? router.push(go as '/notes') : void create(go as CreateAction))}>
          <View className="items-center gap-1.5">
            <View className={`${bg} size-14 items-center justify-center rounded-2xl`}>
              <Icon size={22} color={String(colors[i] ?? '#2563eb')} />
            </View>
            <Text className="text-muted-foreground text-xs font-medium">{label}</Text>
          </View>
        </PressScale>
      ))}
    </View>
  )
}
