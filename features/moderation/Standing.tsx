import { useMutation, useQuery } from '@apollo/client/react'
import { Ban, MessageSquareWarning, ShieldAlert } from 'lucide-react-native'
import { useState } from 'react'
import { TextInput, View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { attempt } from '@/features/groups/shared'
import { Outcome, Pill } from '@/features/shell/Form'
import { LoadState } from '@/features/shell/LoadState'
import { AppealModerationDocument, MyStandingDocument, RemovedGroupDocument, type ReportEntityType } from '@/graphql/generated/graphql'

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' })

/** The one appeal, inline: a suspended account's (USER) or a removed group's owner's (GROUP). */
function AppealForm({ entityType, entityId, onDone }: { entityType: ReportEntityType; entityId: string; onDone: () => void }) {
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  const [appeal, appealing] = useMutation(AppealModerationDocument)
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  if (!open)
    return (
      <View className="flex-row">
        <Pill label="Appeal" onPress={() => setOpen(true)} />
      </View>
    )
  const send = async () => {
    const problem = await attempt(() => appeal({ variables: { input: { entityType, entityId, message: message.trim() } } }), 'The appeal did not go through. Try again.')
    setError(problem)
    if (!problem) onDone()
  }
  return (
    <View className="gap-2">
      <TextInput accessibilityLabel="Tell the moderators why" placeholder="Tell the moderators why" placeholderTextColor={muted} value={message} onChangeText={setMessage} multiline maxLength={2000} className="border-border bg-background text-foreground min-h-20 rounded-xl border px-3 py-2" textAlignVertical="top" />
      <Text className="text-xs opacity-80">You can appeal once. A moderator reads it and decides.</Text>
      <Outcome message={error ? { ok: false, text: error } : null} />
      <View className="flex-row gap-2">
        <Pill label="Send appeal" primary disabled={!message.trim() || appealing.loading} onPress={() => void send()} />
        <Pill label="Cancel" onPress={() => setOpen(false)} />
      </View>
    </View>
  )
}

/**
 * The account's standing on the phone (lvn-backend ADR-0053): a suspension while it lasts, until when and why, what it
 * still allows, and its one appeal; the moderators' warnings of the last 90 days. Nothing when there is nothing.
 */
export function AccountStanding({ userId }: { userId: string }) {
  const { data, refetch } = useQuery(MyStandingDocument, { fetchPolicy: 'cache-and-network' })
  const s = data?.myStanding
  if (!s || (!s.suspendedUntil && !s.warnings.length)) return null
  return (
    <View className="gap-3">
      {s.suspendedUntil ? (
        <View accessibilityRole="alert" className="flex-row gap-3 rounded-2xl border border-red-500/40 bg-red-50 p-4">
          <Ban size={20} color="#b91c1c" />
          <View className="flex-1 gap-2">
            <Text className="font-semibold text-red-950">Your account is suspended until {when(s.suspendedUntil)}.</Text>
            {s.suspensionReason ? <Text className="text-red-950">{s.suspensionReason}</Text> : null}
            <Text className="text-sm text-red-950/80">Until then nothing you do reaches other people: no publishing, sharing, comments, posts, joining or following. You can still read, keep and write your own notes, take a note back to private, block, report and download your data.</Text>
            {s.canAppeal ? <AppealForm entityType="USER" entityId={userId} onDone={() => void refetch()} /> : <Text className="font-medium text-red-950">You have used your one appeal.</Text>}
          </View>
        </View>
      ) : null}
      {s.warnings.length ? (
        <View className="flex-row gap-3 rounded-2xl border border-amber-500/40 bg-amber-50 p-4">
          <MessageSquareWarning size={20} color="#b45309" />
          <View className="flex-1 gap-1.5">
            <Text className="font-semibold text-amber-950">{s.warnings.length === 1 ? 'A warning from the moderators' : `${s.warnings.length} warnings from the moderators`}</Text>
            {s.warnings.map((w, i) => (
              <Text key={i} className="text-amber-950">
                {w.reason} <Text className="text-xs text-amber-950/70">· {new Date(w.at).toLocaleDateString()}</Text>
              </Text>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  )
}

/** Where a group platform moderators removed used to be, for its owner (ADR-0053): why, and the one appeal. */
export function RemovedGroupNotice({ id }: { id: string }) {
  const query = useQuery(RemovedGroupDocument, { variables: { id }, fetchPolicy: 'cache-and-network' })
  const { data, refetch } = query
  const g = data?.removedGroup
  if (!data) return <LoadState query={query} message="This group could not load." className="mx-4" />
  if (!g) return <Text className="text-muted-foreground px-6 py-16 text-center">This group is not available.</Text>
  return (
    <View accessibilityRole="alert" className="m-4 flex-row gap-3 rounded-2xl border border-red-500/40 bg-red-50 p-4">
      <ShieldAlert size={20} color="#b91c1c" />
      <View className="flex-1 gap-2">
        <Text className="text-lg font-bold text-red-950" accessibilityRole="header">
          Moderators removed {g.name}
        </Text>
        <Text className="text-red-950">{g.reason}</Text>
        <Text className="text-sm text-red-950/80">Its members can no longer open it. If moderators put it back, everything in it returns as it was.</Text>
        {g.canAppeal ? <AppealForm entityType="GROUP" entityId={g.id} onDone={() => void refetch()} /> : <Text className="font-medium text-red-950">You have used your one appeal.</Text>}
      </View>
    </View>
  )
}
