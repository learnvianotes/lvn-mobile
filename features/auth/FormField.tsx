import type { ReactNode } from 'react'
import { View } from 'react-native'
import { Text } from '@/components/ui/text'

/**
 * A label, the control, a hint and an error, stacked. The control gets its accessible name from `label` (passed to
 * it by the caller as accessibilityLabel); the error is announced when it appears.
 */
export function FormField({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium" importantForAccessibility="no" accessibilityElementsHidden>{label}</Text>
      {children}
      {error ? (
        <Text role="alert" accessibilityLiveRegion="polite" className="text-destructive text-xs font-medium">{error}</Text>
      ) : hint ? (
        <Text className="text-muted-foreground text-xs">{hint}</Text>
      ) : null}
    </View>
  )
}
