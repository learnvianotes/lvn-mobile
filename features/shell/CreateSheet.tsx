import { useQuery } from '@apollo/client/react'
import { Camera, FileUp, FolderGit2, Layers, ListChecks, Megaphone, Mic, NotebookPen, PenLine, Zap, type LucideIcon } from 'lucide-react-native'
import { Portal } from '@rn-primitives/portal'
import { router } from 'expo-router'
import { useEffect } from 'react'
import { BackHandler, Pressable, View } from 'react-native'
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { createNote } from '@/features/notes/store/actions'
import { ViewerDocument } from '@/graphql/generated/graphql'
import { PressScale } from './PressScale'

/**
 * The centre sheet of spec §13.1: Note, Quick Note, Voice Note, Photo, Upload, Quiz, Flashcard; then a project for
 * everyone, and a blog post or a post for teachers (lvn-backend ADR-0014, ADR-0052).
 */
const OPTIONS: { label: string; icon: LucideIcon }[] = [
  { label: 'Note', icon: NotebookPen },
  { label: 'Quick note', icon: Zap },
  { label: 'Voice note', icon: Mic },
  { label: 'Photo', icon: Camera },
  { label: 'Upload', icon: FileUp },
  { label: 'Quiz', icon: ListChecks },
  { label: 'Flashcards', icon: Layers },
]
const KINDS: { label: string; icon: LucideIcon; kind: 'PROJECT' | 'BLOG' | 'POST'; teachers?: boolean }[] = [
  { label: 'Project', icon: FolderGit2, kind: 'PROJECT' },
  { label: 'Blog post', icon: PenLine, kind: 'BLOG', teachers: true },
  { label: 'Post', icon: Megaphone, kind: 'POST', teachers: true },
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
  const primary = String(useCSSVariable('--color-primary') ?? '#4f46e5')
  const viewer = useQuery(ViewerDocument, { skip: !open })
  const teacher = viewer.data?.viewer?.globalRole === 'TEACHER'
  const kinds = KINDS.filter((k) => !k.teachers || teacher)
  // Note, a project, a blog post or a post is written on the phone (it syncs later); the other kinds arrive with their phases.
  const choose = async (label: string) => {
    onClose()
    const kind = KINDS.find((k) => k.label === label)?.kind
    if (label === 'Note' || label === 'Quick note' || kind) {
      const id = await createNote({ id: '', name: '' }, kind)
      router.push(`/notes/${id}`)
    }
  }
  return (
    <Portal name="create-sheet">
      {open ? (
        <View className="absolute inset-0 justify-end" accessibilityViewIsModal>
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={{ position: 'absolute', inset: 0 }}>
            <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(14,14,18,0.45)' }} accessibilityLabel="Close" />
          </Animated.View>
          <Animated.View
            entering={SlideInDown.springify().damping(20).stiffness(220)}
            exiting={SlideOutDown.duration(180)}
            className="bg-card gap-4 rounded-t-3xl px-5 pt-3"
            style={{ paddingBottom: insets.bottom + 24 }}
          >
            <View className="bg-border h-1.5 w-10 self-center rounded-full" />
            <Text className="text-lg font-bold" accessibilityRole="header">Create</Text>
            <View className="flex-row flex-wrap gap-3">
              {[...OPTIONS, ...kinds].map(({ label, icon: Icon }) => (
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
