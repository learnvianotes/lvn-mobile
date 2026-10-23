import { router } from 'expo-router'
import { X } from 'lucide-react-native'
import { Modal, Pressable, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'

const LINKS = [
  { label: 'Features', action: 'features' as const },
  { label: 'Subjects', action: 'subjects' as const },
  { label: 'Community', action: 'community' as const },
  { label: 'Resources', action: 'resources' as const },
]

/** Public header menu. It is named Browse, not Menu — Menu is the signed-in drawer. */
export function BrowseMenu({ open, onClose, onFeatures }: { open: boolean; onClose: () => void; onFeatures?: () => void }) {
  const insets = useSafeAreaInsets()
  const fg = String(useCSSVariable('--color-foreground') ?? '#152033')
  const choose = (action: (typeof LINKS)[number]['action']) => {
    onClose()
    if (action === 'features') onFeatures?.()
    else router.push('/sign-in')
  }
  return (
    <Modal visible={open} animationType="fade" transparent onRequestClose={onClose} accessibilityViewIsModal>
      <Pressable onPress={onClose} className="flex-1 bg-black/40" accessibilityLabel="Close">
        <View className="bg-card border-border mx-4 gap-1 rounded-3xl border p-3" style={{ marginTop: insets.top + 56 }}>
          <View className="flex-row items-center justify-between px-1">
            <Text className="text-base font-semibold">Browse</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} className="size-10 items-center justify-center rounded-full">
              <X size={20} color={fg} />
            </Pressable>
          </View>
          {LINKS.map((item) => (
            <Pressable key={item.label} accessibilityRole="link" accessibilityLabel={item.label} onPress={() => choose(item.action)} className="min-h-10 justify-center rounded-xl px-3">
              <Text className="text-base">{item.label}</Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" accessibilityLabel="Get Started" onPress={() => { onClose(); router.push('/sign-up') }} className="bg-primary mt-1 min-h-11 items-center justify-center rounded-[14px]">
            <Text className="text-primary-foreground font-semibold">Get Started</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  )
}
