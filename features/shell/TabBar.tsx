import type { Tabs } from 'expo-router'
import type { ComponentProps } from 'react'
import { Compass, House, Plus, User, Users, type LucideIcon } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { haptic } from '@/lib/haptics'
import { CreateSheet } from './CreateSheet'
import { DeletionBanner } from '@/features/data/DeleteAccountCard'

/** expo-router ships its own React Navigation; take the tab bar's props from its Tabs component. */
type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0]

const ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  index: { icon: House, label: 'Home' },
  explore: { icon: Compass, label: 'Explore' },
  community: { icon: Users, label: 'Community' },
  profile: { icon: User, label: 'Profile' },
}

function TabItem({ focused, name, onPress }: { focused: boolean; name: string; onPress: () => void }) {
  const reduced = useReducedMotion()
  const [primary, muted] = useCSSVariable(['--color-primary', '--color-muted-foreground']) as (string | undefined)[]
  const p = useSharedValue(focused ? 1 : 0)
  useEffect(() => {
    p.value = reduced ? (focused ? 1 : 0) : withTiming(focused ? 1 : 0, { duration: 180 })
  }, [focused, reduced, p])
  const icon = useAnimatedStyle(() => ({ transform: [{ translateY: -2 * p.value }, { scale: 1 + 0.08 * p.value }] }))
  const dot = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ scale: p.value }] }))
  const { icon: Icon, label } = ICONS[name] ?? { icon: House, label: name }
  const color = String((focused ? primary : muted) ?? '#5f5f73')
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center gap-1 pt-2"
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
    >
      <Animated.View style={icon}>
        <Icon size={22} color={color} strokeWidth={focused ? 2.4 : 2} />
      </Animated.View>
      <Text className={focused ? 'text-primary text-[11px] font-semibold' : 'text-muted-foreground text-[11px]'}>{label}</Text>
      <Animated.View style={dot} className="bg-primary size-1 rounded-full" />
    </Pressable>
  )
}

/** Bottom tabs of spec §13.1 — Home · Explore · ＋ · Community · Profile — with the raised centre button of the UI board. */
export function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
  const [open, setOpen] = useState(false)
  const reduced = useReducedMotion()
  const turn = useSharedValue(0)
  const fg = String(useCSSVariable('--color-primary-foreground') ?? '#ffffff')
  useEffect(() => {
    turn.value = reduced ? (open ? 1 : 0) : withSpring(open ? 1 : 0, { damping: 14, stiffness: 260 })
  }, [open, reduced, turn])
  const plus = useAnimatedStyle(() => ({ transform: [{ rotate: `${45 * turn.value}deg` }] }))

  const items = state.routes.map((route, index) => (
    <TabItem
      key={route.key}
      name={route.name}
      focused={state.index === index}
      onPress={() => {
        const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
        if (state.index !== index && !event.defaultPrevented) {
          haptic.tick()
          navigateToTab(route.key)
        }
      }}
    />
  ))

  return (
    <>
      <DeletionBanner />
      <View className="bg-card border-border flex-row border-t" style={{ paddingBottom: Math.max(insets.bottom, 10) }}>
        {items.slice(0, 2)}
        <View className="flex-1 items-center">
          <Pressable
            onPress={() => {
              haptic.press()
              setOpen((o) => !o)
            }}
            accessibilityRole="button"
            accessibilityLabel={open ? 'Close create menu' : 'Create'}
            className="bg-primary -mt-6 size-[60px] items-center justify-center rounded-full"
            style={{ shadowColor: '#152033', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 }}
          >
            <Animated.View style={plus}>
              <Plus size={28} color={fg} strokeWidth={2.6} />
            </Animated.View>
          </Pressable>
        </View>
        {items.slice(2)}
      </View>
      <CreateSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}
