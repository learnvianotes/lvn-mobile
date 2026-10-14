import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { ArrowLeft, BadgeCheck, Bell, ChevronRight } from 'lucide-react-native'
import { useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { SignOutDocument, ViewerDocument, type ViewerFieldsFragment } from '@/graphql/generated/graphql'
import { signedOut } from '@/lib/auth/session'
import { ImportCard } from '@/features/data/ImportCard'
import { YourDataCard } from '@/features/data/YourDataCard'
import { InstitutionalEmailCard, LegacyDataCard, StudyDetailsCard } from './AccountDetails'
import { copy } from './copy'
import { Notice } from './Notice'
import { forgetPushToken } from '@/features/push/push'
import { AiAccountCard } from '@/features/ai/AiScreen'
import { InterestsCard } from './Interests'

const card = 'bg-card border-border gap-3 rounded-2xl border p-5'

/**
 * Settings, behind the Profile tab's gear (lvn-backend ADR-0076): who is signed in and how they are verified, the
 * college email, study details, old-site data, AI, notification settings, your data and imports, and sign-out
 * (Phase 1, lvn-backend P3n).
 */
export function AccountScreen() {
  const { data, loading } = useQuery(ViewerDocument)
  const viewer = data?.viewer
  const insets = useSafeAreaInsets()
  const fg = String(useCSSVariable('--color-foreground') ?? '#111827')
  return (
    <View className="bg-background flex-1">
      <View className="flex-row items-center gap-2 px-3 pb-2" style={{ paddingTop: insets.top + 6 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/profile'))} className="rounded-full p-2">
          <ArrowLeft size={22} color={fg} />
        </Pressable>
        <Text className="text-lg font-bold" accessibilityRole="header">
          {copy.account.title}
        </Text>
      </View>
      <ScrollView contentContainerClassName="gap-5 px-5 pt-2" contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}>
        {viewer ? <Account viewer={viewer} /> : loading ? <ActivityIndicator accessibilityLabel="Loading" /> : <Notice>{copy.errors.generic}</Notice>}
        {viewer ? <StudyDetailsCard /> : null}
        {viewer ? <InterestsCard /> : null}
        {viewer ? <LegacyDataCard /> : null}
        {viewer ? <AiAccountCard className={card} /> : null}
        {viewer ? <NotificationSettingsLink /> : null}
        {viewer ? <YourDataCard /> : null}
        {viewer ? <ImportCard /> : null}
        <SignOutButton />
      </ScrollView>
    </View>
  )
}

function NotificationSettingsLink() {
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  const primary = String(useCSSVariable('--color-primary') ?? '#4f46e5')
  return (
    <Pressable accessibilityRole="link" onPress={() => router.push('/notification-settings')} className="bg-card border-border flex-row items-center gap-3 rounded-2xl border px-5 py-4">
      <Bell size={20} color={primary} />
      <Text className="flex-1 font-semibold">Notification settings</Text>
      <ChevronRight size={18} color={muted} />
    </Pressable>
  )
}

function Account({ viewer }: { viewer: ViewerFieldsFragment }) {
  const t = copy.account
  const success = String(useCSSVariable('--color-success') ?? '#15803d')
  return (
    <>
      <View className="flex-row items-center gap-4">
        <View className="bg-secondary size-14 items-center justify-center rounded-full" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Text className="text-secondary-foreground text-xl font-bold">{viewer.displayName.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-lg font-semibold">{viewer.displayName}</Text>
          <Text className="text-muted-foreground text-sm">@{viewer.handle} · {viewer.email}</Text>
        </View>
      </View>

      <View className={card}>
        <View className="flex-row items-center gap-2" accessible accessibilityRole="header">
          {viewer.verified ? <BadgeCheck size={20} color={success} /> : null}
          <Text className="text-base font-semibold">
            {viewer.verified ? t.verified : t.notVerified}
            {viewer.verified && viewer.verificationMethod ? <Text className="text-muted-foreground text-sm font-normal"> {t.verifiedBy[viewer.verificationMethod]}</Text> : null}
          </Text>
        </View>
        {!viewer.verified ? <Text className="text-muted-foreground text-sm">{t.verifyLead}</Text> : null}
        {!viewer.emailVerified ? <Notice tone="info">{t.emailUnverified}</Notice> : null}
        {viewer.restrictedMinor ? <Notice tone="info">{t.minor}</Notice> : null}
      </View>

      <InstitutionalEmailCard viewer={viewer} />
    </>
  )
}

function SignOutButton() {
  const client = useApolloClient()
  const [signOut] = useMutation(SignOutDocument)
  const [busy, setBusy] = useState(false)
  return (
    <Button
      testID="sign-out"
      variant="outline"
      size="lg"
      disabled={busy}
      onPress={async () => {
        setBusy(true)
        // This phone stops getting the account's pushes; the API revokes this device's refresh-token family; offline,
        // the tokens are still removed here.
        await forgetPushToken(client)
        await signOut().catch(() => undefined)
        await client.clearStore()
        await signedOut()
      }}
    >
      <Text className="text-destructive">{copy.account.signOut}</Text>
    </Button>
  )
}
