import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { X } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, ScrollView, Share, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { attempt } from '@/features/groups/shared'
import { Choices, Field, Outcome, Pill, ScreenHeader, Toggle } from '@/features/shell/Form'
import {
  ChangeNoteVisibilityDocument,
  NoteSharesDocument,
  PhoneNoteMetaDocument,
  SetNoteForkingDocument,
  SetNoteSharedWithConnectionsDocument,
  ShareNoteDocument,
  UnshareNoteDocument,
  ViewerDocument,
  type NoteShareRole,
  type Visibility,
} from '@/graphql/generated/graphql'
import { env } from '@/lib/env'
import { syncSoon } from '../sync/engine'

const HINT: Record<Visibility, string> = { PRIVATE: 'Only you.', SHARED: 'You and the people you add below.', PUBLIC: 'Anyone with the link reads the published version.' }
const ROLE: Record<NoteShareRole, string> = { VIEWER: 'Can view', EDITOR: 'Can edit' }

/**
 * Who can read a note, on the phone (spec §4.2, §4.4; lvn-backend ADR-0044, ADR-0052): private, shared or public;
 * the people it is shared with and what each can do; a teacher's connections all at once; whether others may copy it;
 * and the link to send. The same mutations as the web's share dialog.
 */
export function ShareScreen({ id }: { id: string }) {
  const client = useApolloClient()
  const insets = useSafeAreaInsets()
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#3d4b63')
  const meta = useQuery(PhoneNoteMetaDocument, { variables: { id }, fetchPolicy: 'cache-and-network' })
  const shares = useQuery(NoteSharesDocument, { variables: { id }, fetchPolicy: 'cache-and-network' })
  const [changeVisibility] = useMutation(ChangeNoteVisibilityDocument)
  const [share, sharing] = useMutation(ShareNoteDocument)
  const [unshare] = useMutation(UnshareNoteDocument)
  const [setForking] = useMutation(SetNoteForkingDocument)
  const [setConnections] = useMutation(SetNoteSharedWithConnectionsDocument)
  const [person, setPerson] = useState('')
  const [role, setRole] = useState<NoteShareRole>('VIEWER')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const viewer = useQuery(ViewerDocument).data?.viewer
  const m = meta.data?.note
  const people = shares.data?.note?.shares ?? []
  const teacher = shares.data?.viewer?.globalRole === 'TEACHER'
  const run = async (fn: () => Promise<{ data?: unknown }>, done?: string) => {
    const problem = await attempt(fn)
    setMessage(problem ? { ok: false, text: problem } : done ? { ok: true, text: done } : null)
    await Promise.all([meta.refetch(), shares.refetch()])
    // The phone's copy shows the new visibility after the next pull.
    syncSoon(client, 0)
    return problem
  }
  if (!m) return <View className="bg-background flex-1"><ScreenHeader title="Share this note" />{meta.error ? <Text className="text-muted-foreground px-6 py-16 text-center">Connect to the internet to share this note.</Text> : null}</View>
  const offPublic = m.moderation?.state === 'HIDDEN' || m.moderation?.state === 'REMOVED'
  // Public notes have their own page (`/n/<slug>-<id>`, as lvn-web's publicNotePath); shared ones open in the app.
  const link = new URL(m.visibility === 'PUBLIC' ? `/n/${m.slug || 'note'}-${m.id}` : `/notes/${m.id}`, env.EXPO_PUBLIC_WEB_URL).toString()
  return (
    <View className="bg-background flex-1">
      <ScreenHeader title="Share this note" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
        <Outcome message={message} />
        <Choices
          label="Who can read it"
          value={m.visibility}
          onChange={(v) => {
            if (!m.viewerCan.changeVisibility || v === m.visibility) return
            if (v === 'PUBLIC' && !m.publishedVersion) return setMessage({ ok: false, text: 'Publish the note first: readers see the published version.' })
            if (v === 'PUBLIC' && offPublic) return setMessage({ ok: false, text: 'Moderators took this note off the public pages. You can appeal from the note.' })
            void run(() => changeVisibility({ variables: { noteId: id, visibility: v } }))
          }}
          options={(['PRIVATE', 'SHARED', 'PUBLIC'] as const).map((v) => ({ value: v, label: v === 'PRIVATE' ? 'Private' : v === 'SHARED' ? 'Shared' : 'Public', hint: v === 'PUBLIC' && !m.publishedVersion ? 'Publish the note first: readers see the published version.' : HINT[v] }))}
        />
        <ShareGate viewerVerified={viewer?.verified} canChange={m.viewerCan.changeVisibility} canShare={m.viewerCan.share} />

        <View className="gap-3">
          <Text className="text-sm font-semibold" accessibilityRole="header">
            People
          </Text>
          <Field label="Handle or email" placeholder="@handle or email" value={person} onChangeText={setPerson} autoCapitalize="none" autoCorrect={false} editable={m.viewerCan.share} />
          <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup" accessibilityLabel="What they can do">
            {(['VIEWER', 'EDITOR'] as const).map((r) => (
              <Pressable key={r} accessibilityRole="radio" accessibilityState={{ checked: role === r }} onPress={() => setRole(r)} className={`rounded-full px-3 py-1.5 ${role === r ? 'bg-primary' : 'border-border border'}`}>
                <Text className={`text-sm font-semibold ${role === r ? 'text-primary-foreground' : ''}`}>{ROLE[r]}</Text>
              </Pressable>
            ))}
            <View className="flex-1" />
            <Pill label="Add" primary disabled={!person.trim() || sharing.loading || !m.viewerCan.share} onPress={() => void run(() => share({ variables: { noteId: id, person: person.trim(), role } })).then((problem) => !problem && setPerson(''))} />
          </View>
          {people.length ? (
            people.map((s) => (
              <View key={s.user.id} className="bg-card border-border flex-row items-center gap-3 rounded-2xl border px-3 py-2.5">
                <View className="flex-1">
                  <Text className="font-semibold">{s.user.displayName}</Text>
                  <Text className="text-muted-foreground text-xs">@{s.user.handle}</Text>
                </View>
                {s.source === 'CONNECTIONS' ? (
                  <Text className="text-muted-foreground text-xs">Connection</Text>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`What ${s.user.displayName} can do: ${ROLE[s.role]}`}
                    accessibilityHint="Switches between view and edit"
                    onPress={() => void run(() => share({ variables: { noteId: id, person: `@${s.user.handle}`, role: s.role === 'VIEWER' ? 'EDITOR' : 'VIEWER' } }))}
                    className="border-border rounded-full border px-3 py-1"
                  >
                    <Text className="text-xs font-semibold">{ROLE[s.role]}</Text>
                  </Pressable>
                )}
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${s.user.displayName}`} onPress={() => void run(() => unshare({ variables: { noteId: id, userId: s.user.id } }))} className="p-1.5">
                  <X size={18} color={muted} />
                </Pressable>
              </View>
            ))
          ) : (
            <Text className="text-muted-foreground text-sm">Not shared with anyone yet.</Text>
          )}
          {people.length && m.visibility === 'PRIVATE' ? <Text className="text-muted-foreground text-xs">The note is private, so the people above cannot open it until you choose Shared or Public.</Text> : null}
        </View>

        {teacher ? (
          <View className="gap-1">
            <Toggle label="Share with all my connections" value={shares.data?.note?.sharedWithConnections ?? false} onValueChange={(shared) => void run(() => setConnections({ variables: { noteId: id, shared } }))} />
            <Text className="text-muted-foreground text-xs">Teachers you are connected with can read it, and so will teachers you connect with later. Editing is still given person by person.</Text>
          </View>
        ) : null}
        <View className="gap-1">
          <Toggle label="Let people make a copy" value={m.forkingEnabled} onValueChange={(enabled) => void run(() => setForking({ variables: { noteId: id, enabled } }))} />
          <Text className="text-muted-foreground text-xs">Copies are private to whoever makes them and always name you as the author.</Text>
        </View>
        {m.visibility === 'PRIVATE' ? (
          <Text className="text-muted-foreground text-sm">Private notes have no link to share.</Text>
        ) : (
          <View className="flex-row">
            <Pill label="Send the link" onPress={() => void Share.share({ message: `${m.title || 'A note'} on LearnViaNotes: ${link}` })} />
          </View>
        )}
      </ScrollView>
    </View>
  )
}

/**
 * Publish, who can read a note, and sharing it with someone are the verified-account gates the API enforces.
 * The form stays on screen. This sentence appears only when this account is unverified and the matching flag is off.
 */
function ShareGate({ viewerVerified, canChange, canShare }: { viewerVerified?: boolean; canChange: boolean; canShare: boolean }) {
  if (viewerVerified !== false) return null
  const waiting = [!canChange ? 'choosing who can read it' : '', !canShare ? 'sharing it with someone' : ''].filter(Boolean)
  if (!waiting.length) return null
  const list = waiting.length === 2 ? `${waiting[0]} and ${waiting[1]}` : waiting[0]
  return <Text className="text-muted-foreground text-sm">This account is not verified yet, so {list} waits. You can keep writing the note.</Text>
}
