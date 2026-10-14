import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { ArrowLeft, Check, FileText, Globe, Lock, Pin, PinOff, Plus, Trash2, X } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { Alert, BackHandler, Image, Pressable, ScrollView, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { PostComments } from '@/features/discussion/PostComments'
import { ContentModeration, ModerationNotice } from '@/features/moderation/ModerationNotice'
import { PlaceResources } from '@/features/resources/PlaceResources'
import { ModerationQueue } from '@/features/moderation/ModerationQueue'
import { RemovedGroupNotice } from '@/features/moderation/Standing'
import { ReportLink } from '@/features/moderation/ReportSheet'
import { ago } from '@/features/notifications/describe'
import { useLocal } from '@/features/notes/hooks'
import { RichDoc } from '@/features/notes/render/RichText'
import * as db from '@/features/notes/store/db'
import {
  DeleteGroupPostDocument,
  GroupDocument,
  GroupMembersDocument,
  GroupNotesDocument,
  GroupPostsDocument,
  JoinGroupDocument,
  LeaveGroupDocument,
  PinGroupPostDocument,
  RequestToJoinGroupDocument,
  ReviewGroupJoinRequestDocument,
  ShareNoteToGroupDocument,
  UnshareNoteFromGroupDocument,
  ViewerDocument,
  WithdrawGroupJoinRequestDocument,
  type GroupDetailFragment,
} from '@/graphql/generated/graphql'
import type { Doc } from '@/lib/contracts/validation'
import { Doubts, Ideas, WorkspaceHeader } from '@/features/workspaces/WorkspaceParts'
import { confirm, GroupMembers, GroupPicture, GroupSettings, InviteMentor, ShowcaseSetting } from './GroupManage'
import { NewPostSheet } from './NewPostSheet'
import { attempt, ROLE } from './shared'

/** Posts or shared notes picked to delete or take out of the group, and every one that could be (owner, 2026-10-14). */
type Selection = { kind: 'posts' | 'notes'; ids: string[] }
type Selecting = { selection: Selection | null; onSelection: (next: Selection | null) => void }

type Tab = 'posts' | 'ideas' | 'doubts' | 'notes' | 'resources' | 'members' | 'requests' | 'reports' | 'settings'
const TABS: Record<Tab, string> = { posts: 'Posts', ideas: 'Ideas', doubts: 'Doubts', notes: 'Notes', resources: 'Resources', members: 'Members', requests: 'Requests', reports: 'Reports', settings: 'Settings' }

/**
 * One group on the phone (lvn-backend ADR-0045, ADR-0048): joining or asking to; for members, posts (write, and pin or
 * delete as a moderator), shared notes and members; for admins, requests, roles, settings and a workspace's mentor and
 * showcase; for moderators, reports and muting.
 */
export function GroupScreen({ id }: { id: string }) {
  const insets = useSafeAreaInsets()
  const fg = String(useCSSVariable('--color-foreground') ?? '#111827')
  const accent = String(useCSSVariable('--color-primary') ?? '#4f46e5')
  const { data, loading, refetch } = useQuery(GroupDocument, { variables: { id }, fetchPolicy: 'cache-and-network' })
  const [tab, setTab] = useState<Tab>('posts')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [asking, setAsking] = useState(false)
  const [writing, setWriting] = useState(false)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [removing, setRemoving] = useState(false)
  const client = useApolloClient()
  const [deletePost] = useMutation(DeleteGroupPostDocument)
  const [unshare] = useMutation(UnshareNoteFromGroupDocument)
  // The phone's back button ends choosing before it leaves the group.
  useEffect(() => {
    if (!selection) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelection(null)
      return true
    })
    return () => sub.remove()
  }, [selection])
  const [join] = useMutation(JoinGroupDocument)
  const [request] = useMutation(RequestToJoinGroupDocument)
  const [withdraw] = useMutation(WithdrawGroupJoinRequestDocument)
  const [leave] = useMutation(LeaveGroupDocument)
  const group = data?.group
  const run = async (fn: () => Promise<{ data?: unknown }>) => {
    setError(await attempt(fn))
    await refetch()
  }

  const back = (
    <View className="flex-row items-center gap-2 px-3 pb-2" style={{ paddingTop: insets.top + 6 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} className="rounded-full p-2">
        <ArrowLeft size={22} color={fg} />
      </Pressable>
    </View>
  )
  // A group platform moderators removed: its owner reads why here (ADR-0053); for everyone else it is not there.
  if (!group) return <View className="bg-background flex-1">{back}{loading ? null : <RemovedGroupNotice id={id} />}</View>
  const member = !!group.viewerRole
  const project = group.type === 'PROJECT'
  const tabs: Tab[] = member ? ['posts', ...(project ? (['ideas', 'doubts'] as const) : []), 'notes', 'resources', 'members', ...(group.viewerCan.reviewRequests ? (['requests'] as const) : []), ...(group.viewerCan.moderate ? (['reports'] as const) : []), ...(group.viewerCan.manage ? (['settings'] as const) : [])] : []
  const Icon = group.privacy === 'PRIVATE' ? Lock : Globe
  const chosen = selection?.ids.length ?? 0
  /** The chosen posts deleted, or the chosen notes taken out of the group, after asking; what failed is said. */
  const removeChosen = () => {
    if (!selection || !chosen) return
    const posts = selection.kind === 'posts'
    const what = posts ? `${chosen} ${chosen === 1 ? 'post' : 'posts'}` : `${chosen} ${chosen === 1 ? 'note' : 'notes'}`
    confirm(posts ? `Delete ${what}?` : `Take ${what} out of ${group.name}?`, posts ? 'Delete' : 'Remove', () => {
      void (async () => {
        setRemoving(true)
        const problems: string[] = []
        for (const id of selection.ids) {
          const problem = await attempt(() => (posts ? deletePost({ variables: { postId: id } }) : unshare({ variables: { noteId: id, groupId: group.id } })))
          if (problem) problems.push(problem)
        }
        await client.refetchQueries({ include: [GroupPostsDocument, GroupNotesDocument] }).catch(() => undefined)
        setRemoving(false)
        setSelection(null)
        if (problems.length) Alert.alert(posts ? 'Not all deleted' : 'Not all removed', problems[0])
      })()
    }, posts ? 'They are deleted for everyone in the group.' : 'The notes stay yours; the group no longer sees them.')
  }
  // A new post starts from the floating ＋ on the Posts tab (lvn-backend ADR-0076).
  const posting = member && tab === 'posts' && group.viewerCan.post
  return (
    <View className="bg-background flex-1">
      {back}
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + (posting || selection ? 104 : 32) }} keyboardShouldPersistTaps="handled">
        <View className="bg-card border-border gap-2 overflow-hidden rounded-3xl border p-5">
          {group.pictureUrl ? (
            <Image source={{ uri: group.pictureUrl }} accessibilityLabel={`The picture of ${group.name}`} accessibilityIgnoresInvertColors resizeMode="cover" style={{ marginTop: -20, marginHorizontal: -20, marginBottom: 4, height: 150 }} />
          ) : null}
          <View className="flex-row items-center gap-1.5">
            <Icon size={14} color={accent} />
            <Text className="text-muted-foreground text-xs">
              {group.privacy === 'PRIVATE' ? 'Private' : 'Public'}
              {project ? ' · Project' : ''} · {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
              {group.viewerRole ? ` · ${ROLE[group.viewerRole]}` : ''}
            </Text>
          </View>
          <Text className="text-2xl font-extrabold" accessibilityRole="header">
            {group.name}
          </Text>
          {group.description ? <Text className="text-muted-foreground">{group.description}</Text> : null}
          {group.moderationWarning ? <ModerationNotice entityType="GROUP" entityId={group.id} state="OK" reason={group.moderationWarning} canAppeal={false} /> : null}
          {project ? <WorkspaceHeader group={group} onChanged={() => void refetch()} /> : null}
          <View className="flex-row flex-wrap gap-2">
            {group.viewerCan.join ? <Action label="Join" primary onPress={() => void run(() => join({ variables: { groupId: group.id } }))} /> : null}
            {group.viewerCan.requestJoin && !asking ? <Action label="Ask to join" primary onPress={() => setAsking(true)} /> : null}
            {group.viewerRequestId ? <Action label="Withdraw request" onPress={() => void run(() => withdraw({ variables: { requestId: group.viewerRequestId! } }))} /> : null}
            {group.viewerCan.leave ? <Action label="Leave group" onPress={() => void run(() => leave({ variables: { groupId: group.id } }))} /> : null}
            <View className="ml-auto self-center">
              <ReportLink entityType="GROUP" entityId={group.id} authorId={group.owner.id} />
            </View>
          </View>
          {group.viewerRequestId ? <Text className="text-muted-foreground text-sm">Your request is waiting for an answer.</Text> : null}
          {asking && group.viewerCan.requestJoin ? (
            <View className="gap-2">
              <TextInput accessibilityLabel="A note for the admins (optional)" value={message} onChangeText={setMessage} placeholder="A note for the admins (optional)" maxLength={500} multiline className="border-border text-foreground rounded-xl border px-3 py-2" />
              <Action
                label="Send request"
                primary
                onPress={() => {
                  setAsking(false)
                  void run(() => request({ variables: { groupId: group.id, message: message.trim() || null } }))
                }}
              />
            </View>
          ) : null}
          {error ? (
            <Text accessibilityRole="alert" className="text-destructive text-sm">
              {error}
            </Text>
          ) : null}
        </View>
        {member ? (
          <>
            <View className="flex-row flex-wrap gap-2" accessibilityRole="tablist">
              {tabs.map((k) => (
                <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: k === tab }} onPress={() => (setTab(k), setSelection(null))} className={`rounded-full px-4 py-2 ${k === tab ? 'bg-primary' : 'bg-card border-border border'}`}>
                  <Text className={k === tab ? 'text-primary-foreground font-semibold' : 'font-semibold'}>{TABS[k]}</Text>
                </Pressable>
              ))}
            </View>
            {tab === 'posts' ? <Posts group={group} selection={selection} onSelection={setSelection} /> : null}
            {tab === 'ideas' ? <Ideas group={group} /> : null}
            {tab === 'doubts' ? <Doubts group={group} /> : null}
            {tab === 'notes' ? <Notes group={group} selection={selection} onSelection={setSelection} /> : null}
            {tab === 'resources' ? <PlaceResources to={{ groupId: group.id }} /> : null}
            {tab === 'members' ? (
              <View className="gap-3">
                {group.viewerCan.inviteMentor ? <InviteMentor groupId={group.id} /> : null}
                <GroupMembers group={group} onChanged={() => void refetch()} />
              </View>
            ) : null}
            {tab === 'requests' ? <Requests group={group} onChanged={() => void refetch()} /> : null}
            {tab === 'reports' ? <ModerationQueue scope={{ scope: 'GROUP', id: group.id }} groupId={group.id} /> : null}
            {tab === 'settings' ? (
              <View className="gap-8">
                <GroupPicture group={group} onSaved={() => void refetch()} />
                <GroupSettings group={group} onSaved={() => void refetch()} />
                {project ? <ShowcaseSetting group={group} /> : null}
              </View>
            ) : null}
          </>
        ) : (
          <Text className="text-muted-foreground text-center">Posts, notes and members are for members. Join to see them.</Text>
        )}
      </ScrollView>
      {selection ? (
        <View className="bg-card border-border absolute inset-x-0 bottom-0 flex-row items-center gap-3 border-t px-4 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Stop choosing" onPress={() => setSelection(null)} className="rounded-full p-2">
            <X size={22} color={fg} />
          </Pressable>
          <Text className="flex-1 font-semibold">{chosen ? `${chosen} chosen` : selection.kind === 'posts' ? 'Choose posts' : 'Choose notes'}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !chosen || removing }}
            disabled={!chosen || removing}
            onPress={removeChosen}
            className={`bg-destructive flex-row items-center gap-2 rounded-full px-5 py-2.5 ${!chosen || removing ? 'opacity-50' : ''}`}
          >
            <Trash2 size={16} color="#ffffff" />
            <Text className="font-semibold text-white">{selection.kind === 'posts' ? 'Delete' : 'Remove'}</Text>
          </Pressable>
        </View>
      ) : null}
      {posting && !selection ? (
        <>
          <View className="absolute right-5" style={{ bottom: insets.bottom + 24 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="New post" onPress={() => setWriting(true)} className="bg-primary size-14 items-center justify-center rounded-full shadow-lg">
              <Plus size={26} color="#ffffff" />
            </Pressable>
          </View>
          <NewPostSheet groupId={group.id} open={writing} onClose={() => setWriting(false)} />
        </>
      ) : null}
    </View>
  )
}

function Action({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} className={`rounded-full px-4 py-2.5 ${primary ? 'bg-primary' : 'border-border border'}`}>
      <Text className={primary ? 'text-primary-foreground font-semibold' : 'font-semibold'}>{label}</Text>
    </Pressable>
  )
}

function Posts({ group, selection, onSelection }: { group: GroupDetailFragment } & Selecting) {
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  const { data, refetch } = useQuery(GroupPostsDocument, { variables: { id: group.id }, fetchPolicy: 'cache-and-network' })
  const [remove] = useMutation(DeleteGroupPostDocument)
  const [pin] = useMutation(PinGroupPostDocument)
  const [error, setError] = useState<string | null>(null)
  const act = async (fn: () => Promise<{ data?: unknown }>) => {
    setError(await attempt(fn))
    await refetch()
  }
  const posts = [...(data?.group?.posts?.pinned ?? []), ...(data?.group?.posts?.edges.map((e) => e.node) ?? [])]
  const deletable = posts.filter((p) => p.viewerCan.delete).map((p) => p.id)
  const choosing = selection?.kind === 'posts'
  const toggle = (id: string) => onSelection({ kind: 'posts', ids: choosing && selection.ids.includes(id) ? selection.ids.filter((x) => x !== id) : [...(choosing ? selection.ids : []), id] })
  return (
    <View className="gap-3">
      {deletable.length ? <ChooseBar label="posts" choosing={choosing} all={deletable} selection={selection} onSelection={(ids) => onSelection(ids ? { kind: 'posts', ids } : null)} /> : null}
      {error ? (
        <Text accessibilityRole="alert" className="text-destructive text-sm">
          {error}
        </Text>
      ) : null}
      {posts.length ? (
        posts.map((p) => (
          <Pressable
            key={p.id}
            accessible={false}
            // A long press on a post one may delete starts choosing, with it chosen.
            onLongPress={p.viewerCan.delete ? () => toggle(p.id) : undefined}
            onPress={choosing && p.viewerCan.delete ? () => toggle(p.id) : undefined}
            className={`bg-card gap-2 rounded-2xl border p-4 ${choosing && selection.ids.includes(p.id) ? 'border-destructive' : p.pinned ? 'border-primary' : 'border-border'} ${choosing && !p.viewerCan.delete ? 'opacity-50' : ''}`}
          >
            <View className="flex-row items-center gap-2">
              {choosing && p.viewerCan.delete ? <Tick on={selection.ids.includes(p.id)} label={`Choose the post by ${p.author.displayName}`} onPress={() => toggle(p.id)} /> : null}
              <Text className="font-semibold">{p.author.displayName}</Text>
              <Text className="text-muted-foreground flex-1 text-xs">
                {ago(p.createdAt)}
                {p.pinned ? ' · Pinned' : ''}
              </Text>
              {p.viewerCan.pin ? (
                <Pressable accessibilityRole="button" accessibilityLabel={p.pinned ? 'Unpin' : 'Pin'} onPress={() => void act(() => pin({ variables: { postId: p.id, pinned: !p.pinned } }))} className="p-1.5">
                  {p.pinned ? <PinOff size={16} color={muted} /> : <Pin size={16} color={muted} />}
                </Pressable>
              ) : null}
              {p.viewerCan.delete && !choosing ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Delete post" onPress={() => confirm('Delete this post?', 'Delete', () => void act(() => remove({ variables: { postId: p.id } })), 'It is deleted for everyone in the group.')} className="p-1.5">
                  <Trash2 size={16} color={muted} />
                </Pressable>
              ) : null}
              <ReportLink icon entityType="GROUP_POST" entityId={p.id} authorId={p.author.id} />
            </View>
            <ContentModeration entityType="GROUP_POST" item={p} onAppealed={() => void refetch()} />
            <RichDoc doc={p.body as Doc} mentions />
            {choosing ? null : <PostComments type="GROUP_POST" id={p.id} count={p.discussion.commentCount} />}
          </Pressable>
        ))
      ) : data ? (
        <Text className="text-muted-foreground py-6 text-center">No posts yet.</Text>
      ) : null}
    </View>
  )
}

function Notes({ group, selection, onSelection }: { group: GroupDetailFragment } & Selecting) {
  const accent = String(useCSSVariable('--color-primary') ?? '#4f46e5')
  const viewerId = useQuery(ViewerDocument).data?.viewer?.id
  const { data, refetch } = useQuery(GroupNotesDocument, { variables: { id: group.id }, fetchPolicy: 'cache-and-network' })
  const [share] = useMutation(ShareNoteToGroupDocument)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mine = useLocal(() => db.listNotes(false), [picking])
  const notes = data?.group?.sharedNotes?.edges.map((e) => e.node) ?? []
  const shared = new Set(notes.map((n) => n.id))
  // Only a note's owner takes it out of a group.
  const own = notes.filter((n) => n.owner.id === viewerId).map((n) => n.id)
  const choosing = selection?.kind === 'notes'
  const toggle = (id: string) => onSelection({ kind: 'notes', ids: choosing && selection.ids.includes(id) ? selection.ids.filter((x) => x !== id) : [...(choosing ? selection.ids : []), id] })
  return (
    <View className="gap-3">
      {own.length ? <ChooseBar label="your notes" choosing={choosing} all={own} selection={selection} onSelection={(ids) => onSelection(ids ? { kind: 'notes', ids } : null)} /> : null}
      <Pressable accessibilityRole="button" onPress={() => setPicking(!picking)} className="border-border self-start rounded-full border px-4 py-2">
        <Text className="font-semibold">{picking ? 'Close' : 'Share one of your notes'}</Text>
      </Pressable>
      {picking
        ? (mine ?? [])
            .filter((n) => !shared.has(n.id))
            .slice(0, 30)
            .map((n) => (
              <Pressable
                key={n.id}
                accessibilityRole="button"
                accessibilityLabel={`Share ${n.title || 'Untitled note'}`}
                onPress={() =>
                  void attempt(() => share({ variables: { noteId: n.id, groupId: group.id } })).then((p) => {
                    setError(p)
                    setPicking(false)
                    void refetch()
                  })
                }
                className="bg-card border-border rounded-xl border px-3 py-2.5"
              >
                <Text>{n.title || 'Untitled note'}</Text>
              </Pressable>
            ))
        : null}
      {error ? (
        <Text accessibilityRole="alert" className="text-destructive text-sm">
          {error}
        </Text>
      ) : null}
      {notes.length ? (
        notes.map((n) => (
          <Pressable
            key={n.id}
            accessibilityRole={choosing ? undefined : 'link'}
            onPress={() => (choosing ? own.includes(n.id) && toggle(n.id) : router.push(`/notes/${n.id}`))}
            onLongPress={own.includes(n.id) ? () => toggle(n.id) : undefined}
            className={`bg-card flex-row items-start gap-3 rounded-2xl border p-4 ${choosing && selection.ids.includes(n.id) ? 'border-destructive' : 'border-border'} ${choosing && !own.includes(n.id) ? 'opacity-50' : ''}`}
          >
            {choosing && own.includes(n.id) ? <Tick on={selection.ids.includes(n.id)} label={`Choose ${n.title || 'Untitled note'}`} onPress={() => toggle(n.id)} /> : <FileText size={18} color={accent} />}
            <View className="flex-1">
              <Text className="font-semibold">{n.title || 'Untitled note'}</Text>
              <Text className="text-muted-foreground text-xs">by {n.owner.displayName}</Text>
            </View>
          </Pressable>
        ))
      ) : data ? (
        <Text className="text-muted-foreground py-6 text-center">No notes shared yet.</Text>
      ) : null}
    </View>
  )
}

function Requests({ group, onChanged }: { group: GroupDetailFragment; onChanged: () => void }) {
  const { data, refetch } = useQuery(GroupMembersDocument, { variables: { id: group.id }, fetchPolicy: 'cache-and-network' })
  const [review] = useMutation(ReviewGroupJoinRequestDocument)
  const requests = data?.group?.joinRequests ?? []
  const decide = async (requestId: string, decision: 'APPROVED' | 'REJECTED') => {
    await review({ variables: { requestId, decision } })
    await refetch()
    onChanged()
  }
  if (!requests.length) return <Text className="text-muted-foreground py-6 text-center">No requests waiting.</Text>
  return (
    <View className="gap-2">
      {requests.map((r) => (
        <View key={r.id} className="bg-card border-border gap-2 rounded-2xl border p-4">
          <Text className="font-semibold">{r.user.displayName}</Text>
          {r.message ? <Text className="text-muted-foreground text-sm">“{r.message}”</Text> : null}
          <View className="flex-row gap-2">
            <Action label="Approve" primary onPress={() => void decide(r.id, 'APPROVED')} />
            <Action label="Reject" onPress={() => void decide(r.id, 'REJECTED')} />
          </View>
        </View>
      ))}
    </View>
  )
}

/** Above a list: "Select" to start choosing; while choosing, "Select all" or "Clear". */
function ChooseBar({ label, choosing, all, selection, onSelection }: { label: string; choosing: boolean; all: string[]; selection: Selection | null; onSelection: (ids: string[] | null) => void }) {
  const every = choosing && all.every((id) => selection!.ids.includes(id))
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-muted-foreground text-sm">{choosing ? 'Tap to choose, or press and hold' : ''}</Text>
      {choosing ? (
        <Pressable accessibilityRole="button" onPress={() => onSelection(every ? [] : all)} className="rounded-full px-3 py-1.5">
          <Text className="text-primary font-semibold">{every ? 'Clear' : 'Select all'}</Text>
        </Pressable>
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel={`Select ${label} to ${label === 'posts' ? 'delete' : 'remove'}`} onPress={() => onSelection([])} className="border-border rounded-full border px-4 py-1.5">
          <Text className="font-semibold">Select</Text>
        </Pressable>
      )}
    </View>
  )
}

function Tick({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={label} onPress={onPress} hitSlop={8} className={`size-6 items-center justify-center rounded-full border-2 ${on ? 'bg-destructive border-destructive' : 'border-muted-foreground'}`}>
      {on ? <Check size={14} color="#ffffff" /> : null}
    </Pressable>
  )
}
