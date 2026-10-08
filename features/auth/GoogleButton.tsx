import { ActivityIndicator, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { PressScale } from '@/features/shell/PressScale'
import { cn } from '@/lib/utils'
import { copy } from './copy'
import { GoogleMark } from './GoogleMark'

/**
 * "Continue with Google" in Google's own button styles (Sign in with Google branding guidelines): dark
 * (#131314 / #8E918F / #E3E3E3) on light surfaces, light (#FFFFFF / #747775 / #1F1F1F) on dark ones, the unmodified
 * G mark, never recoloured to our brand.
 */
export function GoogleButton({ onPress, busy, disabled, tone = 'dark', testID }: { onPress: () => void; busy?: boolean; disabled?: boolean; tone?: 'dark' | 'light'; testID?: string }) {
  const dark = tone === 'dark'
  return (
    <PressScale
      testID={testID}
      onPress={onPress}
      disabled={disabled || busy}
      feedback="press"
      scaleTo={0.97}
      accessibilityRole="button"
      accessibilityLabel={copy.providers.google}
      accessibilityState={{ disabled: disabled || busy, busy }}
    >
      <View
        className={cn('h-14 flex-row items-center justify-center gap-3 rounded-full border px-6', (disabled || busy) && 'opacity-80')}
        style={{ backgroundColor: dark ? '#131314' : '#FFFFFF', borderColor: dark ? '#8E918F' : '#747775' }}
      >
        {busy ? <ActivityIndicator color={dark ? '#E3E3E3' : '#1F1F1F'} /> : <GoogleMark size={20} />}
        <Text className="text-base font-semibold" style={{ color: dark ? '#E3E3E3' : '#1F1F1F' }}>
          {busy ? copy.providers.googleBusy : copy.providers.google}
        </Text>
      </View>
    </PressScale>
  )
}
