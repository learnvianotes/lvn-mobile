import { X } from 'lucide-react-native'
import { useEffect, useRef, useState } from 'react'
import { Modal, Pressable, ScrollView, View, type View as RNView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { AppearanceCard } from '@/features/settings/AppearanceCard'
import { useTheme } from '@/lib/theme'

/** Top-bar control. Opens the same Appearance picker Profile shows on the page. */
export function AppearanceButton() {
  const [open, setOpen] = useState(false)
  const { palette } = useTheme()
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel="Appearance" accessibilityState={{ expanded: open }} onPress={() => setOpen(true)} className="size-10 items-center justify-center rounded-full" hitSlop={4}>
        <View className="border-border size-5 rounded-full border-2" style={{ backgroundColor: palette.brand }} accessibilityElementsHidden importantForAccessibility="no" />
      </Pressable>
      {open ? <AppearanceSheet onClose={() => setOpen(false)} /> : null}
    </>
  )
}

function AppearanceSheet({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets()
  const fg = String(useCSSVariable('--color-foreground') ?? '#152033')
  const closeRef = useRef<RNView>(null)
  useEffect(() => {
    const node = closeRef.current as { focus?: () => void } | null
    node?.focus?.()
  }, [])
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} accessibilityViewIsModal>
      <Pressable onPress={onClose} className="flex-1 justify-end bg-black/40 px-4" style={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }}>
        <Pressable onPress={() => undefined} className="bg-card border-border max-h-full w-full max-w-[448px] self-center rounded-3xl border">
          <View className="flex-row items-center justify-end px-2 pt-2">
            <Pressable ref={closeRef} accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} className="size-10 items-center justify-center rounded-full">
              <X size={22} color={fg} />
            </Pressable>
          </View>
          <ScrollView contentContainerClassName="px-4 pb-5" keyboardShouldPersistTaps="handled">
            <AppearanceCard />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
