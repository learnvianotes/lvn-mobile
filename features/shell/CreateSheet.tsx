import { useQuery } from '@apollo/client/react'
import { Camera, FileUp, FolderGit2, Layers, ListChecks, Megaphone, Mic, NotebookPen, PenLine, Zap, type LucideIcon } from 'lucide-react-native'
import { Portal } from '@rn-primitives/portal'
import { useEffect } from 'react'
import { BackHandler, Pressable, View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { ViewerDocument } from '@/graphql/generated/graphql'
import { useCreate, type CreateAction } from './create'
import { PressScale } from './PressScale'
import { SHEET_IN, SHEET_OUT } from './sheet-motion'
import { UPLOAD_ACTIONS, useUploadsEnabled } from '@/features/notes/media/uploads'

/**
 * The centre sheet of spec §13.1: Note, Quick Note, Voice Note, Photo, Upload, Quiz, Flashcard; then a project for
 * everyone, and a blog post or a post for teachers (lvn-backend ADR-0014, ADR-0052).
 */
const OPTIONS: { label: CreateAction; icon: LucideIcon }[] = [
  { label: 'Note', icon: NotebookPen },
  { label: 'Quick note', icon: Zap },
  { label: 'Voice note', icon: Mic },
  { label: 'Photo', icon: Camera },
  { label: 'Upload', icon: FileUp },
  { label: 'Quiz', icon: ListChecks },
  { label: 'Flashcards', icon: Layers },
]
const KINDS: { label: CreateAction; icon: LucideIcon; teachers?: boolean }[] = [
  { label: 'Project', icon: FolderGit2 },
  { label: 'Blog post', icon: PenLine, teachers: true },
  { label: 'Post', icon: Megaphone, teachers: true },
]

/**
 * Rendered through a portal into the root view (PortalHost in app/_layout.tsx) rather than a system Modal: the root
 * is edge-to-edge, so the backdrop and sheet reach the bottom of the screen on every Android version.
 */
export function CreateSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets()
  useEffect(() => {
    if (!open) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose()
      return true
    })
    return () => sub.remove()
  }, [open, onClose])
  const primary = String(useCSSVariable('--color-primary') ?? '#2563eb')
  const create = useCreate()
  const viewer = useQuery(ViewerDocument, { skip: !open })
  const teacher = viewer.data?.viewer?.globalRole === 'TEACHER'
  const kinds = KINDS.filter((k) => !k.teachers || teacher)
  // Voice note, Photo and Upload send files: only while uploads are on (lvn-backend ADR-0097).
  const uploadsOn = useUploadsEnabled()
  const options = OPTIONS.filter((o) => uploadsOn || !UPLOAD_ACTIONS.has(o.label))
  const choose = async (label: CreateAction) => {
    onClose()
    await create(label)
  }
  return (
    <Portal name="create-sheet">
      {open ? (
        <View className="absolute inset-0 justify-end" accessibilityViewIsModal>
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={{ position: 'absolute', inset: 0 }}>
            <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(14,14,18,0.45)' }} accessibilityLabel="Close" />
          </Animated.View>
          <Animated.View
            entering={SHEET_IN}
            exiting={SHEET_OUT}
            className="bg-card gap-4 rounded-t-3xl px-5 pt-3"
            style={{ paddingBottom: insets.bottom + 24 }}
          >
            <View className="bg-border h-1.5 w-10 self-center rounded-full" />
            <Text className="text-lg font-bold" accessibilityRole="header">Create</Text>
            <View className="flex-row flex-wrap gap-3">
              {[...options, ...kinds].map(({ label, icon: Icon }) => (
                <PressScale key={label} onPress={() => void choose(label)} accessibilityRole="button" accessibilityLabel={label} style={{ width: '30.5%' }}>
                  <View className="bg-secondary items-center gap-2 rounded-2xl py-4">
                    <Icon size={22} color={primary} />
                    <Text className="text-secondary-foreground text-xs font-semibold">{label}</Text>
                  </View>
                </PressScale>
              ))}
            </View>
          </Animated.View>
        </View>
      ) : null}
    </Portal>
  )
}
