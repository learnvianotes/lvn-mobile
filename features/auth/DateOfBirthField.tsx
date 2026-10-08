import { View } from 'react-native'
import { Text } from '@/components/ui/text'
import { TextField } from './Controls'
import { copy } from './copy'

export interface DobParts {
  day: string
  month: string
  year: string
}

const digits = (max: number) => (v: string) => v.replace(/\D/g, '').slice(0, max)

/** Day, month and year as three number fields (GOV.UK's date input), so nobody scrolls a picker back twenty years. */
export function DateOfBirthField({ value, onChange, invalid }: { value: DobParts; onChange: (v: DobParts) => void; invalid?: boolean }) {
  const t = copy.signUp
  const part = (key: keyof DobParts, label: string, max: number, width: string) => (
    <View className={`gap-1 ${width}`}>
      <Text className="text-muted-foreground text-xs" importantForAccessibility="no" accessibilityElementsHidden>{label}</Text>
      <TextField
        testID={`dob-${key}`}
        accessibilityLabel={`${t.dob}, ${label}`}
        value={value[key]}
        onChangeText={(v) => onChange({ ...value, [key]: digits(max)(v) })}
        keyboardType="number-pad"
        maxLength={max}
        invalid={invalid}
        className="text-center"
      />
    </View>
  )
  return (
    <View className="flex-row gap-3">
      {part('day', t.day, 2, 'w-16')}
      {part('month', t.month, 2, 'w-16')}
      {part('year', t.year, 4, 'w-24')}
    </View>
  )
}
