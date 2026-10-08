import type { ReactNode } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native'
import { Wordmark } from '@/components/brand/Logo'
import { SafeAreaView } from '@/components/ui/safe-area-view'
import { Text } from '@/components/ui/text'

/** The frame of every sign-in screen: wordmark, title and lead, then the form, scrolling above the keyboard. */
export function AuthScreen({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  return (
    <SafeAreaView className="bg-background flex-1">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="gap-6 px-6 pb-10 pt-6" keyboardShouldPersistTaps="handled">
          <Wordmark size={30} />
          <View className="gap-1">
            <Text className="text-2xl font-bold tracking-tight" accessibilityRole="header">{title}</Text>
            {lead ? <Text className="text-muted-foreground text-sm">{lead}</Text> : null}
          </View>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
