import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { MoreHorizontal } from 'lucide-react-native'
import { useState } from 'react'
import { Alert, Image, Pressable, View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { mimeOf, uploadFile, UploadError } from '@/features/notes/media/NoteMedia'
import { ActionSheet, type SheetAction } from '@/features/shell/ActionSheet'
import { Choices, Field, Outcome, Pill, Toggle } from '@/features/shell/Form'
import {
  DeleteGroupDocument,
  GroupMembersDocument,
  GroupNotesDocument,
  InviteMentorDocument,
  MuteGroupMemberDocument,
  RemoveGroupMemberDocument,
  SetGroupRoleDocument,
  SetProjectShowcaseDocument,
  UpdateGroupDocument,
  WorkspaceDocument,
  type GroupDetailFragment,
  type GroupMembersQuery,
  type GroupPrivacy,
} from '@/graphql/generated/graphql'
import { attempt, PRIVACY, RANK, ROLE } from './shared'

type Member = NonNullable<NonNullable<GroupMembersQuery['group']>['members']>[number]
type Message = { ok: boolean; text: string } | null

/** Asks before something that cannot be undone; Android's alert holds the two buttons fine. */
export function confirm(title: string, action: string, run: () => void, message?: string) {
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: action, style: 'destructive', onPress: run },
  ])
}

/**
 * A group's members (ADR-0045). Admins change the roles of those below them and remove them, the owner hands the group
 * over, moderators mute for a day; each from a sheet behind the member's "more" button.
 */
export function GroupMembers({ group, onChanged }: { group: GroupDetailFragment; onChanged: () => void }) {
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  const { data, refetch } = useQuery(GroupMembersDocument, { variables: { id: group.id }, fetchPolicy: 'cache-and-network' })
  const [setRole] = useMutation(SetGroupRoleDocument)
  const [remove] = useMutation(RemoveGroupMemberDocument)
  const [mute] = useMutation(MuteGroupMemberDocument)
  const [chosen, setChosen] = useState<Member | null>(null)
  const [message, setMessage] = useState<Message>(null)
  const mine = RANK[group.viewerRole ?? 'MEMBER']
  const act = async (fn: () => Promise<{ data?: unknown }>, done?: string) => {
    const problem = await attempt(fn)
    setMessage(problem ? { ok: false, text: problem } : done ? { ok: true, text: done } : null)
    await refetch()
    onChanged()
  }
  const actionsFor = (m: Member): SheetAction[] => {
    const name = m.user.displayName
    const list: SheetAction[] = []
    const isMuted = !!m.mutedUntil && new Date(m.mutedUntil) > new Date()
    // A mentor stays a mentor (ADR-0048): they are removed, never given another role or the group.
    if (group.viewerCan.manage && m.role !== 'MENTOR') {
      for (const r of ['ADMIN', 'MODERATOR', 'MEMBER'] as const) {
        if (r !== m.role && RANK[r] < mine) list.push({ text: `Make ${ROLE[r].toLowerCase()}`, onPress: () => void act(() => setRole({ variables: { groupId: group.id, userId: m.user.id, role: r } }), `${name} is now ${ROLE[r].toLowerCase()}.`) })
      }
      if (group.viewerRole === 'OWNER')
        list.push({
          text: `Hand the group to ${name}`,
          onPress: () => confirm(`Hand ${group.name} to ${name}?`, 'Hand over', () => void act(() => setRole({ variables: { groupId: group.id, userId: m.user.id, role: 'OWNER' } }), `${name} owns the group now. You stay on as an admin.`), 'You stay on as an admin.'),
        })
    }
    if (group.viewerCan.moderate)
      list.push({ text: isMuted ? 'Unmute' : 'Mute for a day', onPress: () => void act(() => mute({ variables: { groupId: group.id, userId: m.user.id, until: isMuted ? null : new Date(Date.now() + 86_400_000).toISOString() } }), isMuted ? `${name} can post again.` : `${name} can't post or comment for a day.`) })
    if (group.viewerCan.manage) list.push({ text: 'Remove from the group', destructive: true, onPress: () => confirm(`Remove ${name} from ${group.name}?`, 'Remove', () => void act(() => remove({ variables: { groupId: group.id, userId: m.user.id } }), `${name} was removed.`)) })
    return list
  }
  return (
    <View className="gap-2">
      <Outcome message={message} />
      {(data?.group?.members ?? []).map((m) => {
        const below = RANK[m.role] < mine
        const isMuted = !!m.mutedUntil && new Date(m.mutedUntil) > new Date()
        const manageable = below && (group.viewerCan.manage || group.viewerCan.moderate)
        return (
          <View key={m.user.id} className="bg-card border-border flex-row items-center gap-3 rounded-2xl border p-3">
            <Pressable accessibilityRole="link" accessibilityLabel={m.user.displayName} onPress={() => router.push(`/u/${m.user.handle}`)} className="flex-1 flex-row items-center gap-3">
              <View className="bg-secondary size-9 items-center justify-center rounded-full">
                <Text className="text-secondary-foreground font-bold">{m.user.displayName.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View className="flex-1">
                <Text className="font-semibold">{m.user.displayName}</Text>
                <Text className="text-muted-foreground text-xs">
                  {ROLE[m.role]}
                  {isMuted ? ' · muted' : ''}
                </Text>
              </View>
            </Pressable>
            {manageable ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`Manage ${m.user.displayName}`} onPress={() => setChosen(m)} className="p-2">
                <MoreHorizontal size={20} color={muted} />
              </Pressable>
            ) : null}
          </View>
        )
      })}
      <ActionSheet name="group-member" title={chosen?.user.displayName} actions={chosen ? actionsFor(chosen) : []} open={!!chosen} onClose={() => setChosen(null)} />
    </View>
  )
}

/** A group's name, description, privacy and join policy, and deleting it (ADR-0045). */
const PICTURE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/** The group's picture (lvn-backend ADR-0076): chosen and saved at once by an admin, or taken away. */
export function GroupPicture({ group, onSaved }: { group: GroupDetailFragment; onSaved: () => void }) {
  const client = useApolloClient()
  const [update] = useMutation(UpdateGroupDocument)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  const save = async (input: { pictureFileId?: string; removePicture?: boolean }, done: string) => {
    const problem = await attempt(() => update({ variables: { input: { groupId: group.id, ...input } } }))
    setMessage(problem ? { ok: false, text: problem } : { ok: true, text: done })
    onSaved()
  }
  const choose = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 })
    const a = res.canceled ? null : res.assets[0]
    if (!a) return
    const name = a.fileName ?? a.uri.split('/').pop() ?? 'group.jpg'
    const mimeType = mimeOf(name, a.mimeType)
    if (!PICTURE_TYPES.includes(mimeType) || (a.fileSize ?? 0) > 2 * 1024 ** 2) return setMessage({ ok: false, text: 'Choose a JPEG, PNG or WebP picture under 2 MB.' })
    setBusy(true)
    setMessage(null)
    try {
      const fileId = await uploadFile(client, { uri: a.uri, name, mimeType, size: a.fileSize ?? null }, { purpose: 'GROUP_PICTURE' })
      await save({ pictureFileId: fileId }, 'Picture saved.')
    } catch (e) {
      setMessage({ ok: false, text: e instanceof UploadError ? e.message : 'That did not work. Try again.' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <View className="gap-2">
      <Text className="font-semibold">Group picture</Text>
      {group.pictureUrl ? (
        <Image source={{ uri: group.pictureUrl }} accessibilityIgnoresInvertColors style={{ width: 200, height: 100, borderRadius: 12 }} resizeMode="cover" />
      ) : (
        <Text className="text-muted-foreground text-sm">No picture yet.</Text>
      )}
      <View className="flex-row flex-wrap gap-2">
        <Pill label={busy ? 'Uploading…' : group.pictureUrl ? 'Change the picture' : 'Choose a picture'} disabled={busy} onPress={() => void choose()} />
        {group.pictureUrl ? <Pill label="Remove the picture" disabled={busy} onPress={() => void save({ removePicture: true }, 'Picture removed.')} /> : null}
      </View>
      <Text className="text-muted-foreground text-xs">A JPEG, PNG or WebP picture, up to 2 MB. Everyone who sees the group sees it.</Text>
      <Outcome message={message} />
    </View>
  )
}

export function GroupSettings({ group, onSaved }: { group: GroupDetailFragment; onSaved: () => void }) {
  const [update, updating] = useMutation(UpdateGroupDocument)
  const [del] = useMutation(DeleteGroupDocument)
  const [name, setName] = useState(group.name)
  const [description, setDescription] = useState(group.description ?? '')
  const [privacy, setPrivacy] = useState<GroupPrivacy>(group.privacy)
  const [open, setOpen] = useState(group.joinPolicy === 'OPEN')
  const [message, setMessage] = useState<Message>(null)
  const save = async () => {
    const problem = await attempt(() => update({ variables: { input: { groupId: group.id, name: name.trim(), description: description.trim() || null, privacy, joinPolicy: privacy === 'PUBLIC' && open ? 'OPEN' : 'APPROVAL' } } }))
    setMessage(problem ? { ok: false, text: problem } : { ok: true, text: 'Saved.' })
    onSaved()
  }
  const remove = async () => {
    const problem = await attempt(() => del({ variables: { groupId: group.id } }))
    if (problem) return setMessage({ ok: false, text: problem })
    router.replace('/community')
  }
  return (
    <View className="gap-4">
      <Field label="Name" value={name} onChangeText={setName} maxLength={80} />
      <Field label="Description" value={description} onChangeText={setDescription} maxLength={2000} multiline />
      <Choices label="Who can find it" value={privacy} onChange={setPrivacy} options={(['PUBLIC', 'PRIVATE'] as const).map((k) => ({ value: k, ...PRIVACY[k] }))} />
      {privacy === 'PUBLIC' ? <Toggle label="Let people join without approval" value={open} onValueChange={setOpen} /> : null}
      <Outcome message={message} />
      <View className="flex-row flex-wrap justify-between gap-2">
        <Pill label="Save" primary disabled={!name.trim() || updating.loading} onPress={() => void save()} />
      </View>
      {group.viewerCan.delete ? (
        // Its own place, apart from saving: deleting cannot be undone (owner, 2026-10-14).
        <View className="border-destructive/40 mt-4 gap-2 rounded-2xl border p-4" accessibilityRole="summary">
          <Text className="text-destructive font-bold" accessibilityRole="header">
            Delete this group
          </Text>
          <Text className="text-muted-foreground text-sm">Its posts, shared notes, members and requests go for everyone. Notes stay with the people who wrote them. This cannot be undone.</Text>
          <View className="flex-row">
            <Pill label="Delete group" destructive onPress={() => confirm(`Delete ${group.name} for everyone?`, 'Delete', () => void remove(), 'This cannot be undone.')} />
          </View>
        </View>
      ) : null}
    </View>
  )
}

/** Admins invite a teacher to mentor the workspace; the invite lasts 14 days (ADR-0048). */
export function InviteMentor({ groupId }: { groupId: string }) {
  const [invite, inviting] = useMutation(InviteMentorDocument)
  const [person, setPerson] = useState('')
  const [message, setMessage] = useState<Message>(null)
  const send = async () => {
    const problem = await attempt(() => invite({ variables: { groupId, person: person.trim() } }))
    setMessage(problem ? { ok: false, text: problem } : { ok: true, text: 'Invite sent. It lasts 14 days.' })
    if (!problem) setPerson('')
  }
  return (
    <View className="bg-card border-border gap-2 rounded-2xl border p-3">
      <Field label="Invite a mentor" placeholder="A teacher's handle or email" value={person} onChangeText={setPerson} autoCapitalize="none" autoCorrect={false} />
      <View className="flex-row">
        <Pill label="Invite" primary disabled={!person.trim() || inviting.loading} onPress={() => void send()} />
      </View>
      <Outcome message={message} />
    </View>
  )
}

/** Admins choose the showcase: a public project note shared to the workspace, which credits the team (ADR-0048). */
export function ShowcaseSetting({ group }: { group: GroupDetailFragment }) {
  const notes = useQuery(GroupNotesDocument, { variables: { id: group.id }, fetchPolicy: 'cache-and-network' })
  const current = useQuery(WorkspaceDocument, { variables: { id: group.id }, fetchPolicy: 'cache-and-network' })
  const [save, saving] = useMutation(SetProjectShowcaseDocument)
  const [chosen, setChosen] = useState<string | null>(null)
  const [message, setMessage] = useState<Message>(null)
  const choices = (notes.data?.group?.sharedNotes?.edges.map((e) => e.node) ?? []).filter((n) => n.kind === 'PROJECT' && n.visibility === 'PUBLIC')
  const value = chosen ?? current.data?.group?.showcase?.id ?? ''
  const submit = async () => {
    const problem = await attempt(() => save({ variables: { groupId: group.id, noteId: value || null } }))
    setMessage(problem ? { ok: false, text: problem } : { ok: true, text: 'Saved.' })
    void current.refetch()
  }
  return (
    <View className="gap-3">
      <Text className="font-bold" accessibilityRole="header">
        Showcase
      </Text>
      <Choices
        label="A public project note shared to this workspace. It credits everyone on the team and the mentor, and appears on their profiles."
        value={value}
        onChange={setChosen}
        options={[{ value: '', label: 'No showcase' }, ...choices.map((n) => ({ value: n.id, label: n.title || 'Untitled note' }))]}
      />
      {notes.data && !choices.length ? <Text className="text-muted-foreground text-xs">Share a public project note to this workspace to choose it here.</Text> : null}
      <Outcome message={message} />
      <View className="flex-row">
        <Pill label="Save showcase" primary disabled={saving.loading} onPress={() => void submit()} />
      </View>
    </View>
  )
}
