import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { Link, router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { BadgeCheck } from 'lucide-react-native'
import { useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Button } from '@/components/ui/button'
import { SafeAreaView } from '@/components/ui/safe-area-view'
import { Text } from '@/components/ui/text'
import { SignOutDocument, ViewerDocument, type ViewerFieldsFragment } from '@/graphql/generated/graphql'
import { signedOut } from '@/lib/auth/session'
import { env } from '@/lib/env'
import { YourDataCard } from '@/features/data/YourDataCard'
import { copy } from './copy'
import { Notice } from './Notice'
import { forgetPushToken } from '@/features/push/push'

const card = 'bg-card border-border gap-3 rounded-2xl border p-5'

/** Phase 1 account screen: who is signed in, verification, the college email, sign-out. */
export function AccountScreen() {
  const { data, loading } = useQuery(ViewerDocument)
  const viewer = data?.viewer
  return (
    <SafeAreaView className="bg-background flex-1">
      <ScrollView contentContainerClassName="gap-5 px-5 pb-32 pt-4">
        <Text className="text-2xl font-bold tracking-tight" accessibilityRole="header">{copy.account.title}</Text>
        {viewer ? <Account viewer={viewer} /> : loading ? <ActivityIndicator accessibilityLabel="Loading" /> : <Notice>{copy.errors.generic}</Notice>}
        {viewer ? <PeopleLinks handle={viewer.handle} /> : null}
        {viewer ? <YourDataCard /> : null}
        <SignOutButton />
      </ScrollView>
    </SafeAreaView>
  )
}

function Account({ viewer }: { viewer: ViewerFieldsFragment }) {
  const t = copy.account
  const success = String(useCSSVariable('--color-success') ?? '#15803d')
  const status = viewer.institutionalEmailStatus
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

      {status && status !== 'NONE' ? (
        <View className={card}>
          <Text className="text-base font-semibold" accessibilityRole="header">{t.institution}</Text>
          <Text className="text-sm">{t.status[status]?.(viewer.institutionalEmail ?? '')}</Text>
          {viewer.institution ? <Text className="text-muted-foreground text-sm">{viewer.institution.name}</Text> : null}
          {status === 'CODE_SENT' ? (
            <Link href="/verify" asChild>
              <Button size="sm" className="self-start">
                <Text>{t.enterCode}</Text>
              </Button>
            </Link>
          ) : null}
        </View>
      ) : null}

      <View className={card}>
        <Text className="text-muted-foreground text-sm">{t.more}</Text>
        <Button variant="outline" className="self-start" onPress={() => void WebBrowser.openBrowserAsync(new URL('/profile', env.EXPO_PUBLIC_WEB_URL).toString())}>
          <Text>{t.openWeb}</Text>
        </Button>
      </View>
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

/** Your profile as others see it, and your followers, following and blocked people (lvn-backend ADR-0043). */
function PeopleLinks({ handle }: { handle: string }) {
  return (
    <View className={card}>
      <Pressable accessibilityRole="link" onPress={() => router.push(`/u/${handle}`)} className="flex-row items-center justify-between">
        <Text className="font-semibold">See your profile</Text>
        <Text className="text-muted-foreground">›</Text>
      </Pressable>
      <Pressable accessibilityRole="link" onPress={() => router.push('/people')} className="flex-row items-center justify-between">
        <Text className="font-semibold">Followers, following and blocked people</Text>
        <Text className="text-muted-foreground">›</Text>
      </Pressable>
      <Pressable accessibilityRole="link" onPress={() => router.push('/notification-settings')} className="flex-row items-center justify-between">
        <Text className="font-semibold">Notification settings</Text>
        <Text className="text-muted-foreground">›</Text>
      </Pressable>
    </View>
  )
}
