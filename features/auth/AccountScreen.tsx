import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { BadgeCheck } from 'lucide-react-native'
import { useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Button } from '@/components/ui/button'
import { SafeAreaView } from '@/components/ui/safe-area-view'
import { Text } from '@/components/ui/text'
import { SignOutDocument, ViewerDocument, type ViewerFieldsFragment } from '@/graphql/generated/graphql'
import { signedOut } from '@/lib/auth/session'
import { ImportCard } from '@/features/data/ImportCard'
import { YourDataCard } from '@/features/data/YourDataCard'
import { ReviewRequests, VerifyCard } from '@/features/verification/Verification'
import { InstitutionalEmailCard, LegacyDataCard, StudyDetailsCard } from './AccountDetails'
import { copy } from './copy'
import { Notice } from './Notice'
import { forgetPushToken } from '@/features/push/push'
import { AccountStanding } from '@/features/moderation/Standing'
import { AiAccountCard } from '@/features/ai/AiScreen'

const card = 'bg-card border-border gap-3 rounded-2xl border p-5'

/**
 * The account on the phone: who is signed in, standing, verification, the college email, study details, old-site
 * data, your data and imports, sign-out (Phase 1, lvn-backend P3n).
 */
export function AccountScreen() {
  const { data, loading } = useQuery(ViewerDocument)
  const viewer = data?.viewer
  return (
    <SafeAreaView className="bg-background flex-1">
      <ScrollView contentContainerClassName="gap-5 px-5 pb-32 pt-4">
        <Text className="text-2xl font-bold tracking-tight" accessibilityRole="header">{copy.account.title}</Text>
        {viewer ? <AccountStanding userId={viewer.id} /> : null}
        {viewer ? <Account viewer={viewer} /> : loading ? <ActivityIndicator accessibilityLabel="Loading" /> : <Notice>{copy.errors.generic}</Notice>}
        {/* Without a college email (ADR-0019): a teacher vouches, or our team checks proof of study. */}
        {viewer && !viewer.verified ? <VerifyCard restrictedMinor={!!viewer.restrictedMinor} /> : null}
        {viewer?.globalRole === 'TEACHER' && viewer.verified ? <ReviewRequests /> : null}
        {viewer ? <PeopleLinks viewer={viewer} /> : null}
        {viewer ? <StudyDetailsCard /> : null}
        {viewer ? <LegacyDataCard /> : null}
        {viewer ? <AiAccountCard className={card} /> : null}
        {viewer ? <YourDataCard /> : null}
        {viewer ? <ImportCard /> : null}
        <SignOutButton />
      </ScrollView>
    </SafeAreaView>
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

/**
 * Your profile as others see it, your followers, following and blocked people (lvn-backend ADR-0043), notification
 * settings; a teacher's Skills tab, and the platform's moderation queue for platform admins.
 */
function PeopleLinks({ viewer }: { viewer: ViewerFieldsFragment }) {
  return (
    <View className={card}>
      <Pressable accessibilityRole="link" onPress={() => router.push(`/u/${viewer.handle}`)} className="flex-row items-center justify-between">
        <Text className="font-semibold">See your profile</Text>
        <Text className="text-muted-foreground">›</Text>
      </Pressable>
      <Pressable accessibilityRole="link" onPress={() => router.push('/people')} className="flex-row items-center justify-between">
        <Text className="font-semibold">Followers, following and blocked people</Text>
        <Text className="text-muted-foreground">›</Text>
      </Pressable>
      <Pressable accessibilityRole="link" onPress={() => router.push('/exams')} className="flex-row items-center justify-between">
        <Text className="font-semibold">Exams</Text>
        <Text className="text-muted-foreground">›</Text>
      </Pressable>
      <Pressable accessibilityRole="link" onPress={() => router.push('/rhythm')} className="flex-row items-center justify-between">
        <Text className="font-semibold">Rhythm</Text>
        <Text className="text-muted-foreground">›</Text>
      </Pressable>
      <Pressable accessibilityRole="link" onPress={() => router.push('/review')} className="flex-row items-center justify-between">
        <Text className="font-semibold">Review flashcards</Text>
        <Text className="text-muted-foreground">›</Text>
      </Pressable>
      <Pressable accessibilityRole="link" onPress={() => router.push('/history')} className="flex-row items-center justify-between">
        <Text className="font-semibold">Learning history</Text>
        <Text className="text-muted-foreground">›</Text>
      </Pressable>
      <Pressable accessibilityRole="link" onPress={() => router.push('/notification-settings')} className="flex-row items-center justify-between">
        <Text className="font-semibold">Notification settings</Text>
        <Text className="text-muted-foreground">›</Text>
      </Pressable>
      {viewer.globalRole === 'STUDENT' && !viewer.restrictedMinor ? (
        <Pressable accessibilityRole="link" onPress={() => router.push('/teach')} className="flex-row items-center justify-between">
          <Text className="font-semibold">{viewer.teacherStatus === 'PENDING' ? 'Teacher application: being reviewed' : viewer.teacherStatus === 'DECLINED' ? 'Teacher application: not approved — apply again' : 'Teach on LearnViaNotes'}</Text>
          <Text className="text-muted-foreground">›</Text>
        </Pressable>
      ) : null}
      {viewer.globalRole === 'TEACHER' || viewer.teacherStatus === 'PENDING' ? (
        <Pressable accessibilityRole="link" onPress={() => router.push('/skills')} className="flex-row items-center justify-between">
          <Text className="font-semibold">Your Skills tab</Text>
          <Text className="text-muted-foreground">›</Text>
        </Pressable>
      ) : null}
      {viewer.globalRole === 'PLATFORM_ADMIN' ? (
        <Pressable accessibilityRole="link" onPress={() => router.push('/admin/verification')} className="flex-row items-center justify-between">
          <Text className="font-semibold">Proof of study to review</Text>
          <Text className="text-muted-foreground">›</Text>
        </Pressable>
      ) : null}
      {viewer.globalRole === 'PLATFORM_ADMIN' ? (
        <Pressable accessibilityRole="link" onPress={() => router.push('/admin/moderation')} className="flex-row items-center justify-between">
          <Text className="font-semibold">Moderation queue</Text>
          <Text className="text-muted-foreground">›</Text>
        </Pressable>
      ) : null}
    </View>
  )
}
