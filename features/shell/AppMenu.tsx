import { router, type Href } from 'expo-router'
import { X } from 'lucide-react-native'
import { useEffect, useRef } from 'react'
import { Modal, Pressable, ScrollView, View, type PressableInstance } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Wordmark } from '@/components/brand/Logo'
import { Text } from '@/components/ui/text'
import { APP_NAV } from './nav'

/** The signed-in drawer. Same labels and order as the web sidebar. Close is focused when it opens. */
export function AppMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return <AppMenuOpen onClose={onClose} />
}

function AppMenuOpen({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets()
  const fg = String(useCSSVariable('--color-foreground') ?? '#1c1b18')
  const closeRef = useRef<PressableInstance>(null)
  useEffect(() => {
    const node = closeRef.current as { focus?: () => void } | null
    node?.focus?.()
  }, [])
  const go = (href: Href) => {
    onClose()
    router.push(href)
  }
  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose} accessibilityViewIsModal>
      <Pressable accessibilityLabel="Close the menu" onPress={onClose} className="flex-1 bg-black/40">
        <Pressable accessibilityRole="menu" accessibilityLabel="Menu" onPress={() => undefined} className="bg-card border-border h-full w-[86%] max-w-[448px] border-r" style={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }}>
          <View className="flex-row items-center justify-between px-4 pb-2">
            <Wordmark size={30} />
            <Pressable ref={closeRef} accessibilityRole="button" accessibilityLabel="Close the menu" onPress={onClose} className="size-10 items-center justify-center rounded-full">
              <X size={22} color={fg} />
            </Pressable>
          </View>
          <ScrollView contentContainerClassName="px-3 pb-6">
            <Text className="text-muted-foreground px-3 pb-2 pt-3 text-xs font-semibold" accessibilityRole="header">
              Main
            </Text>
            {APP_NAV.map((item) => (
              <Pressable key={item.label} accessibilityRole="menuitem" accessibilityLabel={item.label} onPress={() => go(item.href)} className="min-h-10 justify-center rounded-xl px-3">
                <Text className="text-base">{item.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
