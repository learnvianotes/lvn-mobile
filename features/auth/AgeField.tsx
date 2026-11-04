import { TextField } from './Controls'
import { copy } from './copy'

/**
 * The age in whole years as one short number field (lvn-backend ADR-0104), instead of a date of birth. The number pad
 * opens; anything pasted is kept as typed, so "17.5" is refused with a message instead of quietly becoming "175".
 */
export function AgeField({ testID, value, onChange, onBlur, invalid }: { testID: string; value: string; onChange: (v: string) => void; onBlur?: () => void; invalid?: boolean }) {
  return (
    <TextField
      testID={testID}
      accessibilityLabel={copy.signUp.age}
      value={value}
      onChangeText={onChange}
      onBlur={onBlur}
      keyboardType="number-pad"
      inputMode="numeric"
      maxLength={3}
      autoComplete="off"
      invalid={invalid}
      className="w-24"
    />
  )
}
