import type { ReactNode } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, useWindowDimensions, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { PublicHeader } from '@/features/shell/PublicHeader'
import { copy } from './copy'

const CHIPS = copy.welcome.features

/**
 * Sign-in, sign-up, reset and the other auth screens. Below the large breakpoint the inverse
 * panel is a banner and the form is a sheet that overlaps it. The keyboard scrolls the sheet.
 */
export function AuthScreen({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  const { width } = useWindowDimensions()
  const wide = width >= 640
  return (
    <View className="bg-background flex-1">
      <PublicHeader />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="pb-10" keyboardShouldPersistTaps="handled">
          <View className="bg-hero gap-3 px-6 pb-12 pt-8">
            <View className="bg-primary absolute left-0 right-0 top-0 h-1" />
            <Text className="text-hero-foreground text-3xl font-semibold leading-9 tracking-tight">
              {copy.welcome.headline}
            </Text>
            <Text className="text-hero-muted text-base leading-6">{copy.welcome.lead}</Text>
            {wide ? (
              <View className="mt-2 flex-row flex-wrap gap-2">
                {CHIPS.map((chip) => (
                  <View key={chip} className="rounded-full border border-white/20 px-3 py-2">
                    <Text className="text-hero-foreground text-sm">{chip}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
          <View className="bg-card border-border -mt-6 gap-5 rounded-t-3xl border px-5 pb-8 pt-6">
            <View className="gap-1">
              <Text className="text-2xl font-semibold" accessibilityRole="header">{title}</Text>
              {lead ? <Text className="text-muted-foreground text-sm">{lead}</Text> : null}
            </View>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}
