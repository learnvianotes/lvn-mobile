import { useMutation, useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, ScrollView, Switch, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { attempt } from '@/features/groups/shared'
import { TurnOnPush } from '@/features/push/TurnOnPush'
import { LoadState } from '@/features/shell/LoadState'
import { NotificationSettingsDocument, UpdateNotificationSettingsDocument } from '@/graphql/generated/graphql'
import { LABEL } from './categories'

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

/** Notification settings on the phone (lvn-backend ADR-0050): the same choices as the web, saved as they change. */
export function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets()
  const fg = String(useCSSVariable('--color-foreground') ?? '#111827')
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  const query = useQuery(NotificationSettingsDocument, { fetchPolicy: 'cache-and-network' })
  const { data, refetch } = query
  const [update] = useMutation(UpdateNotificationSettingsDocument)
  const [error, setError] = useState<string | null>(null)
  const s = data?.notificationSettings
  const save = async (input: Record<string, unknown>) => {
    setError(await attempt(() => update({ variables: { input } })))
    await refetch()
  }
  return (
    <View className="bg-background flex-1">
      <View className="flex-row items-center gap-2 px-3 pb-2" style={{ paddingTop: insets.top + 6 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} className="size-10 items-center justify-center rounded-full">
          <ArrowLeft size={22} color={fg} />
        </Pressable>
        <Text className="text-lg font-bold" accessibilityRole="header">
          Notification settings
        </Text>
      </View>
      {s ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
          {!s.pushAvailable ? <Text className="bg-secondary text-muted-foreground rounded-xl p-3 text-xs">Phone notifications aren&apos;t switched on for LearnViaNotes yet. Your choices are kept for when they are.</Text> : <TurnOnPush onEnabled={() => void refetch()} />}
          {error ? (
            <Text accessibilityRole="alert" className="text-destructive text-sm">
              {error}
            </Text>
          ) : null}
          <Text className="font-bold">What reaches your phone</Text>
          {s.categories.map((c) => (
            <View key={c.category} className="border-border gap-2 border-b pb-3">
              <View className="flex-row items-center justify-between gap-3">
                <Text className="flex-1">{LABEL[c.category] ?? c.category}</Text>
                <Switch accessibilityLabel={`Phone notifications for ${LABEL[c.category] ?? c.category}`} value={c.push} onValueChange={(push) => void save({ categories: [{ category: c.category, push }] })} />
              </View>
              {c.email !== null ? (
                <View className="flex-row items-center justify-between gap-3">
                  <Text className="text-muted-foreground flex-1 text-sm">Also by email</Text>
                  <Switch accessibilityLabel={`Emails for ${LABEL[c.category] ?? c.category}`} value={!!c.email} onValueChange={(email) => void save({ categories: [{ category: c.category, email }] })} />
                </View>
              ) : null}
            </View>
          ))}
          <Text className="font-bold">Quiet hours</Text>
          <Text className="text-muted-foreground text-sm">No phone notifications between these times ({s.timeZone.replace('_', ' ')}). They still wait in the app.</Text>
          <View className="flex-row gap-3">
            <QuietTime label="From" value={s.quietStart} muted={muted} onSave={(quietStart) => void save({ quietStart })} />
            <QuietTime label="To" value={s.quietEnd} muted={muted} onSave={(quietEnd) => void save({ quietEnd })} />
          </View>
          <View className="flex-row items-center justify-between gap-3">
            <Text className="flex-1">A Monday email counting what you haven&apos;t read yet</Text>
            <Switch accessibilityLabel="Weekly email" value={s.weeklyDigest} onValueChange={(weeklyDigest) => void save({ weeklyDigest })} />
          </View>
          <Text className="text-muted-foreground text-xs">{s.devices === 1 ? '1 phone gets notifications.' : `${s.devices} phones get notifications.`}</Text>
        </ScrollView>
      ) : (
        <LoadState query={query} message="Your notification settings could not load." className="mx-4" />
      )}
    </View>
  )
}

function QuietTime({ label, value, muted, onSave }: { label: string; value: string; muted: string; onSave: (v: string) => void }) {
  const [text, setText] = useState(value)
  return (
    <View className="flex-1 gap-1">
      <Text className="text-sm font-semibold">{label}</Text>
      <TextInput accessibilityLabel={`Quiet hours ${label.toLowerCase()}`} value={text} onChangeText={setText} onEndEditing={() => HHMM.test(text) && text !== value && onSave(text)} placeholder="22:00" placeholderTextColor={muted} maxLength={5} keyboardType="numbers-and-punctuation" className="border-border text-foreground rounded-xl border px-3 py-2" />
    </View>
  )
}
