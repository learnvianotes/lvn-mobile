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
const ACTIONS: { label: string; hint: string; icon: LucideIcon; go: string | CreateAction }[] = [
  { label: 'Notes', hint: 'Opens your notes', icon: NotebookPen, go: '/notes' },
  { label: 'Q&A', hint: 'Ask about your notes', icon: MessagesSquare, go: '/ask' },
  { label: 'Camera', hint: 'Take photos or add PDFs, and Nova makes notes of them', icon: Camera, go: 'Photo' },
  { label: 'Voice', hint: 'Record a voice note', icon: Mic, go: 'Voice note' },
  { label: 'Upload', hint: 'Put a PDF, picture or recording in a new note', icon: Upload, go: 'Upload' },
]

export function QuickActions() {
  const brand = String(useCSSVariable('--color-primary') ?? '#2847a8')
  const create = useCreate()
  // Camera, Voice and Upload send files: only while uploads are on (lvn-backend ADR-0097).
  const uploadsOn = useUploadsEnabled()
  return (
    <View className="flex-row justify-between">
      {ACTIONS.filter((a) => uploadsOn || !UPLOAD_ACTIONS.has(a.go)).map(({ label, hint, icon: Icon, go }) => (
        <PressScale key={label} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} onPress={() => (go.startsWith('/') ? router.push(go as '/notes') : void create(go as CreateAction))}>
          <View className="items-center gap-1.5">
            <View className="bg-secondary size-14 items-center justify-center rounded-2xl">
              <Icon size={22} color={brand} />
            </View>
            <Text className="text-muted-foreground text-xs font-medium">{label}</Text>
          </View>
        </PressScale>
      ))}
    </View>
  )
}
