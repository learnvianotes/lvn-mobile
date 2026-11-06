import type { ReactNode } from 'react'
import { Linking, Pressable } from 'react-native'
import { Text } from '@/components/ui/text'
import { SUPPORT_EMAIL, supportMailto } from '@/lib/support'

/** Writes to the one support address. The address itself is the label unless a screen names the action. */
export function SupportLink({ children, className, label }: { children?: ReactNode; className?: string; label?: string }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={label ?? `Email ${SUPPORT_EMAIL}`} onPress={() => void Linking.openURL(supportMailto())} className={className ?? 'min-h-10 justify-center'}>
      {children ?? <Text className="text-muted-foreground text-sm">{SUPPORT_EMAIL}</Text>}
    </Pressable>
  )
}
