import { Portal } from '@rn-primitives/portal'
import { useEffect } from 'react'
import { BackHandler, Pressable, View } from 'react-native'
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Text } from '@/components/ui/text'

export type SheetAction = { text: string; destructive?: boolean; onPress: () => void }

/**
 * A menu of actions in a sheet from the bottom, for menus longer than Android's native alert allows (three buttons:
 * a fourth is dropped). Rendered through the root portal, like CreateSheet.
 */
export function ActionSheet({ name, title, actions, open, onClose }: { name: string; title?: string; actions: SheetAction[]; open: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets()
  useEffect(() => {
    if (!open) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose()
      return true
    })
    return () => sub.remove()
  }, [open, onClose])
  return (
    <Portal name={name}>
      {open ? (
        <View className="absolute inset-0 justify-end" accessibilityViewIsModal>
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={{ position: 'absolute', inset: 0 }}>
            <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(14,14,18,0.45)' }} accessibilityLabel="Close" />
          </Animated.View>
          <Animated.View entering={SlideInDown.springify().damping(20).stiffness(220)} exiting={SlideOutDown.duration(180)} className="bg-card gap-1 rounded-t-3xl px-3 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
            <View className="bg-border mb-2 h-1.5 w-10 self-center rounded-full" />
            {title ? (
              <Text className="text-muted-foreground px-3 pb-1 text-sm font-semibold" accessibilityRole="header">
                {title}
              </Text>
            ) : null}
            <View accessibilityRole="menu">
              {actions.map((a) => (
                <Pressable
                  key={a.text}
                  accessibilityRole="menuitem"
                  onPress={() => {
                    onClose()
                    a.onPress()
                  }}
                  className="rounded-xl px-3 py-3.5"
                >
                  <Text className={`text-base ${a.destructive ? 'text-destructive font-semibold' : ''}`}>{a.text}</Text>
                </Pressable>
              ))}
              <Pressable accessibilityRole="button" onPress={onClose} className="rounded-xl px-3 py-3.5">
                <Text className="text-muted-foreground text-base font-semibold">Cancel</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      ) : null}
    </Portal>
  )
}
