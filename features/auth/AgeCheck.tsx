import { UserCheck } from 'lucide-react-native'
import { useEffect, useState, type ReactNode } from 'react'
import { Modal, View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { ageInWords, ageRefusedAt, subscribeAgeRefusal } from '@/lib/auth/age'
import { useColors } from '@/lib/theme'
import { copy } from './copy'

/** Whether this device was refused an account in the last day (lvn-backend ADR-0091). */
export function useAgeRefused(): boolean {
  const [refused, setRefused] = useState(false)
  useEffect(() => {
    let alive = true
    const read = () => void ageRefusedAt().then((at) => alive && setRefused(at !== null))
    read()
    const stop = subscribeAgeRefusal(read)
    return () => {
      alive = false
      stop()
    }
  }, [])
  return refused
}

/**
 * "Is this right?" — asked before every age is sent, whatever the answer, so no answer stands out and one mis-typed
 * digit can't put an account on hold (lvn-backend ADR-0091, ADR-0104).
 */
export function ConfirmAge({ value, busy, onConfirm, onChange }: { value: number | null; busy: boolean; onConfirm: () => void; onChange: () => void }) {
  const t = copy.age
  const colors = useColors()
  return (
    <Modal visible={value !== null} transparent animationType="fade" onRequestClose={onChange}>
      <View className="flex-1 items-center justify-center bg-black/40 px-6">
        <View className="bg-card w-full max-w-sm gap-4 rounded-3xl p-6" accessibilityViewIsModal>
          <Text className="text-xl font-semibold" accessibilityRole="header">{t.confirmTitle}</Text>
          <View className="flex-row items-center gap-3">
            <UserCheck size={22} color={colors.accent} />
            <Text className="flex-1 text-base">
              {t.confirmLead} <Text className="text-base font-semibold">{value === null ? '' : ageInWords(value)}</Text>.
            </Text>
          </View>
          <View className="flex-row justify-end gap-2">
            <Button testID="age-change" variant="outline" disabled={busy} onPress={onChange}>
              <Text>{t.change}</Text>
            </Button>
            <Button testID="age-confirm" disabled={busy} onPress={onConfirm}>
              <Text>{t.confirm}</Text>
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  )
}

/** Shown instead of a sign-up form on a device refused in the last day. It deletes nothing and signs nobody out. */
export function AgeRefused({ action }: { action?: ReactNode }) {
  const t = copy.age
  return (
    <View className="gap-3" accessibilityLiveRegion="polite">
      <Text className="text-lg font-semibold" accessibilityRole="header">{t.refusedTitle}</Text>
      <Text className="text-muted-foreground text-sm leading-5">{t.refusedLead}</Text>
      {action}
    </View>
  )
}
