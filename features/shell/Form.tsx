import { router } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import type { ReactNode } from 'react'
import { Pressable, Switch, TextInput, View, type TextInputProps } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'

/** The back arrow and title above a screen that is not a tab. */
export function ScreenHeader({ title, right }: { title?: string; right?: ReactNode }) {
  const insets = useSafeAreaInsets()
  const fg = String(useCSSVariable('--color-foreground') ?? '#111827')
  return (
    <View className="flex-row items-center gap-2 px-3 pb-2" style={{ paddingTop: insets.top + 6 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} className="size-10 items-center justify-center rounded-full">
        <ArrowLeft size={22} color={fg} />
      </Pressable>
      {title ? (
        <Text className="flex-1 text-lg font-bold" accessibilityRole="header" numberOfLines={1}>
          {title}
        </Text>
      ) : (
        <View className="flex-1" />
      )}
      {right}
    </View>
  )
}

/** A labelled text field; the label is also what a screen reader announces. */
export function Field({ label, hint, ...input }: { label: string; hint?: string } & TextInputProps) {
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-semibold">{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={muted} className={`border-border bg-card text-foreground rounded-xl border px-3 ${input.multiline ? 'min-h-20 py-2' : 'py-2.5'} text-base`} textAlignVertical={input.multiline ? 'top' : 'center'} {...input} />
      {hint ? <Text className="text-muted-foreground text-xs">{hint}</Text> : null}
    </View>
  )
}

export type Option<T extends string> = { value: T; label: string; hint?: string }

/** One choice of a few, each with an optional line under it. */
export function Choices<T extends string>({ label, options, value, onChange }: { label: string; options: Option<T>[]; value: T; onChange: (value: T) => void }) {
  return (
    <View className="gap-2" accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text className="text-sm font-semibold">{label}</Text>
      {options.map((o) => {
        const on = o.value === value
        return (
          <Pressable key={o.value} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={o.label} onPress={() => onChange(o.value)} className={`flex-row items-start gap-3 rounded-2xl border px-3 py-3 ${on ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}>
            <View className={`mt-0.5 size-5 items-center justify-center rounded-full border-2 ${on ? 'border-primary' : 'border-border'}`}>{on ? <View className="bg-primary size-2.5 rounded-full" /> : null}</View>
            <View className="flex-1 gap-0.5">
              <Text className="font-semibold">{o.label}</Text>
              {o.hint ? <Text className="text-muted-foreground text-xs">{o.hint}</Text> : null}
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}

/** A yes-or-no setting with a switch. */
export function Toggle({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (value: boolean) => void }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="flex-1">{label}</Text>
      <Switch accessibilityLabel={label} value={value} onValueChange={onValueChange} />
    </View>
  )
}

/** A rounded button: filled for the main action, outlined otherwise, red text for what cannot be undone. */
export function Pill({ label, onPress, primary, destructive, disabled, accessibilityLabel }: { label: string; onPress: () => void; primary?: boolean; destructive?: boolean; disabled?: boolean; accessibilityLabel?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} className={`rounded-full px-4 py-2.5 ${primary ? (disabled ? 'bg-muted' : 'bg-primary') : 'border-border border'}`}>
      <Text className={`font-semibold ${primary ? 'text-primary-foreground' : destructive ? 'text-destructive' : ''}`}>{label}</Text>
    </Pressable>
  )
}

/** What happened after a save: a quiet confirmation or an alert. */
export function Outcome({ message }: { message: { ok: boolean; text: string } | null }) {
  if (!message) return null
  return (
    <Text accessibilityRole={message.ok ? undefined : 'alert'} accessibilityLiveRegion="polite" className={message.ok ? 'text-primary text-sm' : 'text-destructive text-sm'}>
      {message.text}
    </Text>
  )
}
