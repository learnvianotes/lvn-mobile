import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { CopyPlus, MoreHorizontal } from 'lucide-react-native'
import { useEffect, useRef, useState } from 'react'
import { Alert, Pressable, View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { attempt } from '@/features/groups/shared'
import { ActionSheet, type SheetAction } from '@/features/shell/ActionSheet'
import { ForkNoteDocument, PhoneNoteMetaDocument, PublishNoteDocument } from '@/graphql/generated/graphql'
import { useLocal } from '../hooks'
import type { LocalNote } from '../model/types'
import * as db from '../store/db'
import { syncNow } from '../sync/engine'

export const KIND_LABEL: Record<LocalNote['kind'], string> = { NOTE: 'Note', PROJECT: 'Project', BLOG: 'Blog post', POST: 'Post' }
const VISIBILITY: Record<LocalNote['visibility'], string> = { PRIVATE: 'Private', SHARED: 'Shared', PUBLIC: 'Public' }

/**
 * The owner's note, beyond writing it (lvn-backend ADR-0052): what it is and where it stands, and a menu to publish,
 * share, organise, look back through versions or move it to the trash. Everything but the trash needs the server, so a
 * note made here waits until it has been sent, and publishing waits for unsent changes.
 */
export function useNoteActions(note: LocalNote, onTrash: () => void) {
  const client = useApolloClient()
  const unsent = useLocal(() => db.unsentNoteIds().then((s) => s.has(note.id)), [note.id]) ?? false
  const meta = useQuery(PhoneNoteMetaDocument, { variables: { id: note.id }, skip: note.localOnly || note.access !== 'OWNER', fetchPolicy: 'cache-and-network', errorPolicy: 'all' })
  const [publish, publishing] = useMutation(PublishNoteDocument)
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  // A new note stops being local-only when it is queued, before the server has it: ask again once it has been sent.
  const refetch = meta.refetch
  const wasUnsent = useRef(unsent)
  useEffect(() => {
    if (wasUnsent.current && !unsent && !note.localOnly && note.access === 'OWNER') void refetch().catch(() => undefined)
    wasUnsent.current = unsent
  }, [unsent, note.localOnly, note.access, refetch])
  const m = meta.data?.note
  const online = (go: () => void) => () => {
    if (note.localOnly || !m) return Alert.alert('This needs a connection', note.localOnly ? 'The note is still only on this phone. It is sent as soon as you are online.' : 'Connect to the internet and try again.')
    go()
  }
  const doPublish = async () => {
    if (unsent) {
      setMessage({ ok: false, text: 'Your latest changes are still on this phone. They are being sent; publish again in a moment.' })
      await syncNow(client)
      return
    }
    let number: number | undefined
    const problem = await attempt(async () => {
      const res = await publish({ variables: { noteId: note.id } })
      number = res.data?.publishNote.note?.publishedVersion?.number
      return res
    })
    setMessage(problem ? { ok: false, text: problem } : { ok: true, text: `Published as version ${number ?? 1}.` })
    if (!problem) void syncNow(client)
  }
  const actions: SheetAction[] = [
    ...(m?.viewerCan.publish !== false ? [{ text: m?.publishedVersion ? 'Publish changes' : 'Publish', onPress: online(() => void doPublish()) }] : []),
    { text: 'Share and who can read it', onPress: online(() => router.push(`/notes/share/${note.id}`)) },
    { text: 'Folder, tags and topics', onPress: online(() => router.push(`/notes/details/${note.id}`)) },
    { text: 'Version history', onPress: online(() => router.push(`/notes/versions/${note.id}`)) },
    { text: 'Move to trash', destructive: true, onPress: onTrash },
  ]
  const status = m
    ? `${KIND_LABEL[m.kind]} · ${VISIBILITY[m.visibility]} · ${m.publishedVersion ? `Published: version ${m.publishedVersion.number}` : 'Draft, not published'}`
    : `${KIND_LABEL[note.kind]} · ${VISIBILITY[note.visibility]}${note.publishedAt ? ' · Published' : ''}`
  return {
    button: <MoreButton onPress={() => setOpen(true)} />,
    sheet: <ActionSheet name="note-actions" title={note.title || 'Untitled note'} actions={actions} open={open} onClose={() => setOpen(false)} />,
    status,
    verifyToPublish: m && !m.viewerCan.publish,
    publishing: publishing.loading,
    message,
  }
}

function MoreButton({ onPress }: { onPress: () => void }) {
  const fg = String(useCSSVariable('--color-foreground') ?? '#111827')
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Note actions" onPress={onPress} className="rounded-full p-2">
      <MoreHorizontal size={22} color={fg} />
    </Pressable>
  )
}

/** Where an owner's note stands, and what the last action said. */
export function NoteStatus({ status, message, verifyToPublish }: { status: string; message: { ok: boolean; text: string } | null; verifyToPublish?: boolean | null }) {
  return (
    <View className="gap-1">
      <Text className="text-muted-foreground text-xs font-semibold" accessibilityLabel={`Status: ${status}`}>
        {status}
      </Text>
      {verifyToPublish ? <Text className="text-muted-foreground text-xs">Verify your account to publish notes.</Text> : null}
      {message ? (
        <Text accessibilityRole={message.ok ? undefined : 'alert'} accessibilityLiveRegion="polite" className={message.ok ? 'text-primary text-sm font-semibold' : 'text-destructive text-sm'}>
          {message.text}
        </Text>
      ) : null}
    </View>
  )
}

/**
 * A reader makes a private copy of a note that allows it (§4.4): it is credited to the author, and opens once this
 * phone has it.
 */
export function MakeCopyButton({ noteId }: { noteId: string }) {
  const client = useApolloClient()
  const fg = String(useCSSVariable('--color-foreground') ?? '#111827')
  const meta = useQuery(PhoneNoteMetaDocument, { variables: { id: noteId }, fetchPolicy: 'cache-and-network', errorPolicy: 'all' })
  const [fork, forking] = useMutation(ForkNoteDocument)
  if (!meta.data?.note?.viewerCan.fork) return null
  const copy = async () => {
    let id: string | undefined
    const problem = await attempt(async () => {
      const res = await fork({ variables: { noteId } })
      id = res.data?.forkNote.note?.id
      return res
    }, 'Could not make a copy. Try again.')
    if (problem || !id) return Alert.alert('No copy made', problem ?? 'Could not make a copy. Try again.')
    await syncNow(client)
    router.replace(`/notes/${id}`)
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Make a copy" accessibilityHint="A private copy for you to change, credited to the author" disabled={forking.loading} onPress={() => void copy()} className="rounded-full p-2">
      <CopyPlus size={21} color={fg} />
    </Pressable>
  )
}
