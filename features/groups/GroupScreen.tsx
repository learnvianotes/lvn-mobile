import { useMutation, useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { ArrowLeft, FileText, Globe, Lock, Pin, PinOff, Trash2 } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, ScrollView, TextInput, View } from 'react-native'
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
  CreateGroupPostDocument,
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
  WithdrawGroupJoinRequestDocument,
  type GroupDetailFragment,
} from '@/graphql/generated/graphql'
import type { Doc } from '@/lib/contracts/validation'
import { Doubts, Ideas, WorkspaceHeader } from '@/features/workspaces/WorkspaceParts'
import { GroupMembers, GroupSettings, InviteMentor, ShowcaseSetting } from './GroupManage'
import { attempt, ROLE, textToDoc } from './shared'

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
  return (
    <View className="bg-background flex-1">
      {back}
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
        <View className="bg-card border-border gap-2 rounded-3xl border p-5">
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
                <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: k === tab }} onPress={() => setTab(k)} className={`rounded-full px-4 py-2 ${k === tab ? 'bg-primary' : 'bg-card border-border border'}`}>
                  <Text className={k === tab ? 'text-primary-foreground font-semibold' : 'font-semibold'}>{TABS[k]}</Text>
                </Pressable>
              ))}
            </View>
            {tab === 'posts' ? <Posts group={group} /> : null}
            {tab === 'ideas' ? <Ideas group={group} /> : null}
            {tab === 'doubts' ? <Doubts group={group} /> : null}
            {tab === 'notes' ? <Notes group={group} /> : null}
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
                <GroupSettings group={group} onSaved={() => void refetch()} />
                {project ? <ShowcaseSetting group={group} /> : null}
              </View>
            ) : null}
          </>
        ) : (
          <Text className="text-muted-foreground text-center">Posts, notes and members are for members. Join to see them.</Text>
        )}
      </ScrollView>
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

function Posts({ group }: { group: GroupDetailFragment }) {
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  const { data, refetch } = useQuery(GroupPostsDocument, { variables: { id: group.id }, fetchPolicy: 'cache-and-network' })
  const [create] = useMutation(CreateGroupPostDocument)
  const [remove] = useMutation(DeleteGroupPostDocument)
  const [pin] = useMutation(PinGroupPostDocument)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const act = async (fn: () => Promise<{ data?: unknown }>) => {
    setError(await attempt(fn))
    await refetch()
  }
  const posts = [...(data?.group?.posts?.pinned ?? []), ...(data?.group?.posts?.edges.map((e) => e.node) ?? [])]
  return (
    <View className="gap-3">
      {group.viewerCan.post ? (
        <View className="bg-card border-border gap-2 rounded-2xl border p-3">
          <TextInput accessibilityLabel="Write a post" value={text} onChangeText={setText} placeholder="Share something with the group…" placeholderTextColor={muted} multiline className="text-foreground min-h-16" />
          <Pressable
            accessibilityRole="button"
            disabled={!text.trim()}
            onPress={() =>
              void act(async () => {
                const res = await create({ variables: { groupId: group.id, body: textToDoc(text) } })
                if (res.data?.createGroupPost.post) setText('')
                return res
              })
            }
            className={`self-end rounded-full px-4 py-2 ${text.trim() ? 'bg-primary' : 'bg-muted'}`}
          >
            <Text className="text-primary-foreground font-semibold">Post</Text>
          </Pressable>
        </View>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" className="text-destructive text-sm">
          {error}
        </Text>
      ) : null}
      {posts.length ? (
        posts.map((p) => (
          <View key={p.id} className={`bg-card gap-2 rounded-2xl border p-4 ${p.pinned ? 'border-primary' : 'border-border'}`}>
            <View className="flex-row items-center gap-2">
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
              {p.viewerCan.delete ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Delete post" onPress={() => void act(() => remove({ variables: { postId: p.id } }))} className="p-1.5">
                  <Trash2 size={16} color={muted} />
                </Pressable>
              ) : null}
              <ReportLink icon entityType="GROUP_POST" entityId={p.id} authorId={p.author.id} />
            </View>
            <ContentModeration entityType="GROUP_POST" item={p} onAppealed={() => void refetch()} />
            <RichDoc doc={p.body as Doc} mentions />
            <PostComments type="GROUP_POST" id={p.id} count={p.discussion.commentCount} />
          </View>
        ))
      ) : data ? (
        <Text className="text-muted-foreground py-6 text-center">No posts yet.</Text>
      ) : null}
    </View>
  )
}

function Notes({ group }: { group: GroupDetailFragment }) {
  const accent = String(useCSSVariable('--color-primary') ?? '#4f46e5')
  const { data, refetch } = useQuery(GroupNotesDocument, { variables: { id: group.id }, fetchPolicy: 'cache-and-network' })
  const [share] = useMutation(ShareNoteToGroupDocument)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mine = useLocal(() => db.listNotes(false), [picking])
  const notes = data?.group?.sharedNotes?.edges.map((e) => e.node) ?? []
  const shared = new Set(notes.map((n) => n.id))
  return (
    <View className="gap-3">
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
          <Pressable key={n.id} accessibilityRole="link" onPress={() => router.push(`/notes/${n.id}`)} className="bg-card border-border flex-row items-start gap-3 rounded-2xl border p-4">
            <FileText size={18} color={accent} />
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
