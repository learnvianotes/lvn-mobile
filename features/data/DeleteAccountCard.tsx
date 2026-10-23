import { useMutation, useQuery } from '@apollo/client/react'
import { AlertTriangle } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import { CancelAccountDeletionDocument, RequestAccountDeletionDocument, ViewerDocument } from '@/graphql/generated/graphql'

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })

/**
 * Settings → Delete your account (lvn-backend ADR-0088): the password (when the account has one) and the word DELETE ask
 * for it; 14 days later it goes. Until then the date shows here and above the tabs, with Keep my account.
 */
export function DeleteAccountCard() {
  const viewer = useQuery(ViewerDocument).data?.viewer
  const [request, requesting] = useMutation(RequestAccountDeletionDocument, { refetchQueries: [ViewerDocument], awaitRefetchQueries: true })
  const [cancel, cancelling] = useMutation(CancelAccountDeletionDocument, { refetchQueries: [ViewerDocument], awaitRefetchQueries: true })
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const destructive = String(useCSSVariable('--color-destructive') ?? '#9f1d1d')
  if (!viewer) return null
  const scheduled = viewer.deletionScheduledFor
  const ready = confirm.trim().toUpperCase() === 'DELETE'

  return (
    <View className="bg-card border-destructive/40 gap-3 rounded-2xl border p-5" accessibilityLabel="Delete your account" testID="delete-account">
      <View className="flex-row items-center gap-2">
        <AlertTriangle size={18} color={destructive} />
        <Text className="text-destructive text-lg font-bold" accessibilityRole="header">
          Delete your account
        </Text>
      </View>
      <Text className="text-muted-foreground text-sm">
        Your account, your private notes, files and learning history are deleted 14 days after you ask. Notes you made public, and your posts and comments, stay, by “Deleted user”. Download your data first if you want a copy.
      </Text>
      {scheduled ? (
        <>
          <Text className="text-sm font-semibold" accessibilityLiveRegion="polite">
            Your account will be deleted on {day(scheduled)}. Every other device was signed out.
          </Text>
          <Button className="self-start" disabled={cancelling.loading} onPress={() => void cancel().catch(() => setError('That did not work. Try again.'))}>
            <Text>Keep my account</Text>
          </Button>
        </>
      ) : (
        <>
          <View className="gap-1">
            <Text className="text-sm font-medium">Your password</Text>
            <Input value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" accessibilityLabel="Your password" testID="delete-password" />
            <Text className="text-muted-foreground text-xs">If you sign in with Google, leave it empty.</Text>
          </View>
          <View className="gap-1">
            <Text className="text-sm font-medium">Type DELETE to confirm</Text>
            <Input value={confirm} onChangeText={setConfirm} autoCapitalize="characters" autoCorrect={false} accessibilityLabel="Type DELETE to confirm" testID="delete-confirm" />
          </View>
          {error ? <Text className="text-destructive text-sm" accessibilityLiveRegion="polite">{error}</Text> : null}
          <Button
            variant="destructive"
            className="self-start"
            disabled={!ready || requesting.loading}
            accessibilityState={{ disabled: !ready || requesting.loading }}
            onPress={async () => {
              setError(null)
              const res = await request({ variables: { input: { password: password || null, confirm } } }).catch(() => null)
              const problem = res?.data?.requestAccountDeletion.userErrors[0]?.message
              if (problem || !res) setError(problem ?? 'That did not work. Try again.')
              else setPassword('')
            }}
          >
            <Text>Delete my account</Text>
          </Button>
        </>
      )}
    </View>
  )
}

/** Above the tabs on every tab while a deletion is scheduled (ADR-0088). */
export function DeletionBanner() {
  const viewer = useQuery(ViewerDocument).data?.viewer
  const [cancel, cancelling] = useMutation(CancelAccountDeletionDocument, { refetchQueries: [ViewerDocument], awaitRefetchQueries: true })
  if (!viewer?.deletionScheduledFor) return null
  return (
    <View className="bg-destructive/10 border-destructive/40 flex-row items-center gap-3 border-t px-4 py-2" accessibilityRole="alert" testID="deletion-banner">
      <Text className="flex-1 text-sm">Your account will be deleted on {day(viewer.deletionScheduledFor)}.</Text>
      <Pressable accessibilityRole="button" disabled={cancelling.loading} onPress={() => void cancel().catch(() => null)} className="bg-destructive rounded-full px-3 py-1.5">
        <Text className="text-primary-foreground text-sm font-semibold">Keep my account</Text>
      </Pressable>
    </View>
  )
}
