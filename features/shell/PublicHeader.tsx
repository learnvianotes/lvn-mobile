import { Link } from 'expo-router'
import { Menu } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Wordmark } from '@/components/brand/Logo'
import { Text } from '@/components/ui/text'
import { BrowseMenu } from './BrowseMenu'
import { AppearanceButton } from './AppearanceButton'

/** Public bar: wordmark, Browse, Sign in, theme. Safe area sits above the 40px controls. */
export function PublicHeader({ onFeatures }: { onFeatures?: () => void }) {
  const insets = useSafeAreaInsets()
  const fg = String(useCSSVariable('--color-foreground') ?? '#152033')
  const [open, setOpen] = useState(false)
  return (
    <View className="border-border bg-card border-b px-3" style={{ paddingTop: insets.top }}>
      <View className="h-14 flex-row items-center gap-1">
        <Pressable accessibilityRole="button" accessibilityLabel="Browse" accessibilityState={{ expanded: open }} onPress={() => setOpen(true)} className="size-10 items-center justify-center rounded-full">
          <Menu size={22} color={fg} />
        </Pressable>
        <View className="flex-1">
          <Wordmark size={28} />
        </View>
        <Link href="/sign-in" asChild>
          <Pressable accessibilityRole="link" accessibilityLabel="Sign in" className="min-h-10 justify-center px-2">
            <Text className="text-sm font-semibold">Sign in</Text>
          </Pressable>
        </Link>
        <AppearanceButton />
      </View>
      <BrowseMenu open={open} onClose={() => setOpen(false)} onFeatures={onFeatures} />
    </View>
  )
}
