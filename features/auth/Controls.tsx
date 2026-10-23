import { Pressable, View } from 'react-native'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'

/** The kit's Input at a 48 dp touch height, marked invalid when its field has an error. */
export function TextField({ invalid, className, ...props }: React.ComponentProps<typeof Input> & { invalid?: boolean }) {
  return <Input className={cn('h-11 rounded-[14px]', invalid && 'border-destructive', className)} aria-invalid={invalid} {...props} />
}

/** A checkbox whose whole row (box and sentence) is one control for touch and for screen readers. */
export function CheckRow({ checked, onChange, label, invalid, testID }: { checked: boolean; onChange: (v: boolean) => void; label: string; invalid?: boolean; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      className="flex-row items-start gap-3 py-1"
    >
      <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden className="pt-0.5">
        <Checkbox checked={checked} onCheckedChange={onChange} className={cn('size-5', invalid && 'border-destructive')} />
      </View>
      <Text className="flex-1 text-sm">{label}</Text>
    </Pressable>
  )
}
