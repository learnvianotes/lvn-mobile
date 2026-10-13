import { useMutation, useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { ArrowLeft, FileText, GraduationCap, MoreHorizontal, Share2, Trash2 } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, ScrollView, Share, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { PostComments } from '@/features/discussion/PostComments'
import { ContentModeration } from '@/features/moderation/ModerationNotice'
import { ModerationQueue } from '@/features/moderation/ModerationQueue'
import { ReportLink } from '@/features/moderation/ReportSheet'
import { attempt, textToDoc } from '@/features/groups/shared'
import { useLocal } from '@/features/notes/hooks'
import { RichDoc } from '@/features/notes/render/RichText'
import * as db from '@/features/notes/store/db'
import { ago } from '@/features/notifications/describe'
import {
  AnswerClassroomInviteDocument,
  ClassroomDocument,
  ClassroomNotesDocument,
  ClassroomPeopleDocument,
  ClassroomPostsDocument,
  CreateClassroomPostDocument,
  DeleteClassroomPostDocument,
  InviteToClassroomDocument,
  LeaveClassroomDocument,
  RemoveClassroomMemberDocument,
  ReviewClassroomJoinRequestDocument,
  SetClassroomRoleDocument,
  ShareNoteToClassroomDocument,
  WithdrawClassroomJoinRequestDocument,
  type ClassroomDetailFragment,
  type ClassroomPeopleQuery,
} from '@/graphql/generated/graphql'
import { env } from '@/lib/env'
import type { Doc } from '@/lib/contracts/validation'
import { ActionSheet } from '@/features/shell/ActionSheet'
import { ClassSettings, memberActions } from './ClassManage'
import { ClassQuizzes } from './quizzes/ClassQuizzes'
import { ClassPerformance, ClassRhythm } from './ClassInsights'
import { CLASS_ROLE } from './shared'

type Tab = 'posts' | 'quizzes' | 'notes' | 'rhythm' | 'performance' | 'people' | 'requests' | 'reports' | 'settings'
const TABS: Record<Tab, string> = { posts: 'Announcements', quizzes: 'Quizzes', notes: 'Notes', rhythm: 'Rhythm', performance: 'Performance', people: 'People', requests: 'Requests', reports: 'Reports', settings: 'Settings' }
type Run = () => Promise<{ data?: unknown }>
type Member = NonNullable<NonNullable<ClassroomPeopleQuery['classroom']>['members']>[number]

/**
 * One class on the phone (lvn-backend ADR-0046): announcements, quizzes (ADR-0064) and notes for members; for staff the code to share,
 * posting, people and invites, requests and reports; for the teacher roles, handing the class over and settings.
 */
export function ClassScreen({ id }: { id: string }) {
  const insets = useSafeAreaInsets()
  const fg = String(useCSSVariable('--color-foreground') ?? '#111827')
  const accent = String(useCSSVariable('--color-primary') ?? '#4f46e5')
  const { data, loading, refetch } = useQuery(ClassroomDocument, { variables: { id }, fetchPolicy: 'cache-and-network' })
  const [tab, setTab] = useState<Tab>('posts')
  const [error, setError] = useState<string | null>(null)
  const [answer] = useMutation(AnswerClassroomInviteDocument)
  const [withdraw] = useMutation(WithdrawClassroomJoinRequestDocument)
  const [leave] = useMutation(LeaveClassroomDocument)
  const classroom = data?.classroom
  const run = async (fn: Run, then?: () => void) => {
    const problem = await attempt(fn)
    setError(problem)
    if (!problem && then) return then()
    await refetch()
  }

  const back = (
    <View className="flex-row items-center gap-2 px-3 pb-2" style={{ paddingTop: insets.top + 6 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} className="rounded-full p-2">
        <ArrowLeft size={22} color={fg} />
      </Pressable>
    </View>
  )
  if (!classroom) return <View className="bg-background flex-1">{back}{loading ? null : <Text className="text-muted-foreground px-6 py-16 text-center">This class is not available.</Text>}</View>
  const staff = classroom.viewerCan.review
  const tabs: Tab[] = classroom.viewerRole ? ['posts', 'quizzes', 'notes', 'rhythm', ...(staff ? (['performance', 'people', 'requests', 'reports'] as const) : []), ...(classroom.viewerCan.manage ? (['settings'] as const) : [])] : []
  return (
    <View className="bg-background flex-1">
      {back}
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
        <View className="bg-card border-border gap-2 rounded-3xl border p-5">
          <View className="flex-row items-center gap-1.5">
            <GraduationCap size={14} color={accent} />
            <Text className="text-muted-foreground text-xs">
              {classroom.teacher.displayName} · {classroom.memberCount} {classroom.memberCount === 1 ? 'person' : 'people'}
              {classroom.viewerRole ? ` · ${CLASS_ROLE[classroom.viewerRole]}` : ''}
            </Text>
          </View>
          <Text className="text-2xl font-extrabold" accessibilityRole="header">
            {classroom.name}
          </Text>
          {classroom.description ? <Text className="text-muted-foreground">{classroom.description}</Text> : null}
          {classroom.joinCode ? (
            <View className="bg-secondary gap-1 rounded-2xl p-3">
              <Text className="text-muted-foreground text-xs font-semibold">Class code</Text>
              <View className="flex-row items-center gap-3">
                <Text accessibilityLabel={`Class code ${classroom.joinCode}`} className="flex-1 font-mono text-xl font-bold tracking-widest">
                  {classroom.joinCode}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Share join link"
                  onPress={() => void Share.share({ message: `Join ${classroom.name} on LearnViaNotes: ${new URL(`/classes/join/${classroom.joinCode}`, env.EXPO_PUBLIC_WEB_URL).toString()} (code ${classroom.joinCode})` })}
                  className="p-1.5"
                >
                  <Share2 size={18} color={accent} />
                </Pressable>
              </View>
              <Text className="text-muted-foreground text-xs">Students ask to join with this code or the link. You or a TA let them in.</Text>
            </View>
          ) : null}
          <View className="flex-row flex-wrap gap-2">
            {classroom.viewerInviteId ? (
              <>
                <Action label="Accept invite" primary onPress={() => void run(() => answer({ variables: { inviteId: classroom.viewerInviteId!, accept: true } }))} />
                <Action label="Decline" onPress={() => void run(() => answer({ variables: { inviteId: classroom.viewerInviteId!, accept: false } }), () => router.back())} />
              </>
            ) : null}
            {classroom.viewerRequestId ? <Action label="Withdraw request" onPress={() => void run(() => withdraw({ variables: { requestId: classroom.viewerRequestId! } }), () => router.back())} /> : null}
            {classroom.viewerCan.leave ? <Action label="Leave class" onPress={() => void run(() => leave({ variables: { classroomId: classroom.id } }), () => router.back())} /> : null}
          </View>
          {classroom.viewerInviteId ? <Text className="text-muted-foreground text-sm">You&apos;ve been invited to this class.</Text> : null}
          {classroom.viewerRequestId ? <Text className="text-muted-foreground text-sm">Your request is waiting for your teacher.</Text> : null}
          {error ? (
            <Text accessibilityRole="alert" className="text-destructive text-sm">
              {error}
            </Text>
          ) : null}
        </View>
        {tabs.length ? (
          <>
            <View className="flex-row flex-wrap gap-2" accessibilityRole="tablist">
              {tabs.map((k) => (
                <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: k === tab }} onPress={() => setTab(k)} className={`rounded-full px-4 py-2 ${k === tab ? 'bg-primary' : 'bg-card border-border border'}`}>
                  <Text className={k === tab ? 'text-primary-foreground font-semibold' : 'font-semibold'}>{TABS[k]}</Text>
                </Pressable>
              ))}
            </View>
            {tab === 'posts' ? <Posts classroom={classroom} /> : null}
            {tab === 'quizzes' ? <ClassQuizzes classroom={classroom} /> : null}
            {tab === 'notes' ? <Notes classroom={classroom} /> : null}
            {tab === 'rhythm' ? <ClassRhythm classroomId={classroom.id} /> : null}
            {tab === 'performance' ? <ClassPerformance classroomId={classroom.id} /> : null}
            {tab === 'people' ? <People classroom={classroom} onChanged={() => void refetch()} /> : null}
            {tab === 'requests' ? <Requests classroom={classroom} onChanged={() => void refetch()} /> : null}
            {tab === 'reports' ? <ModerationQueue scope={{ scope: 'CLASSROOM', id: classroom.id }} /> : null}
            {tab === 'settings' ? <ClassSettings classroom={classroom} onSaved={() => void refetch()} /> : null}
          </>
        ) : null}
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

function Posts({ classroom }: { classroom: ClassroomDetailFragment }) {
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  const { data, refetch } = useQuery(ClassroomPostsDocument, { variables: { id: classroom.id }, fetchPolicy: 'cache-and-network' })
  const [create] = useMutation(CreateClassroomPostDocument)
  const [remove] = useMutation(DeleteClassroomPostDocument)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const act = async (fn: Run) => {
    setError(await attempt(fn))
    await refetch()
  }
  const posts = data?.classroom?.posts?.edges.map((e) => e.node) ?? []
  return (
    <View className="gap-3">
      {classroom.viewerCan.post ? (
        <View className="bg-card border-border gap-2 rounded-2xl border p-3">
          <TextInput accessibilityLabel="Write an announcement" value={text} onChangeText={setText} placeholder="Tell the class something…" placeholderTextColor={muted} multiline className="text-foreground min-h-16" />
          <Pressable
            accessibilityRole="button"
            disabled={!text.trim()}
            onPress={() =>
              void act(async () => {
                const res = await create({ variables: { classroomId: classroom.id, body: textToDoc(text) } })
                if (res.data?.createClassroomPost.classroom) setText('')
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
          <View key={p.id} className="bg-card border-border gap-2 rounded-2xl border p-4">
            <View className="flex-row items-center gap-2">
              <Text className="font-semibold">{p.author.displayName}</Text>
              <Text className="text-muted-foreground flex-1 text-xs">{ago(p.createdAt)}</Text>
              {p.viewerCanDelete ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Delete announcement" onPress={() => void act(() => remove({ variables: { postId: p.id } }))} className="p-1.5">
                  <Trash2 size={16} color={muted} />
                </Pressable>
              ) : null}
              <ReportLink icon entityType="CLASSROOM_POST" entityId={p.id} authorId={p.author.id} />
            </View>
            <ContentModeration entityType="CLASSROOM_POST" item={p} onAppealed={() => void refetch()} />
            <RichDoc doc={p.body as Doc} />
            <PostComments type="CLASSROOM_POST" id={p.id} count={p.discussion.commentCount} />
          </View>
        ))
      ) : data ? (
        <Text className="text-muted-foreground py-6 text-center">No announcements yet.</Text>
      ) : null}
    </View>
  )
}

function Notes({ classroom }: { classroom: ClassroomDetailFragment }) {
  const accent = String(useCSSVariable('--color-primary') ?? '#4f46e5')
  const { data, refetch } = useQuery(ClassroomNotesDocument, { variables: { id: classroom.id }, fetchPolicy: 'cache-and-network' })
  const [share] = useMutation(ShareNoteToClassroomDocument)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mine = useLocal(() => db.listNotes(false), [picking])
  const notes = data?.classroom?.sharedNotes?.edges.map((e) => e.node) ?? []
  const shared = new Set(notes.map((n) => n.id))
  return (
    <View className="gap-3">
      {classroom.viewerCan.post ? (
        <Pressable accessibilityRole="button" onPress={() => setPicking(!picking)} className="border-border self-start rounded-full border px-4 py-2">
          <Text className="font-semibold">{picking ? 'Close' : 'Share one of your notes'}</Text>
        </Pressable>
      ) : null}
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
                  void attempt(() => share({ variables: { noteId: n.id, classroomId: classroom.id } })).then((p) => {
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

function People({ classroom, onChanged }: { classroom: ClassroomDetailFragment; onChanged: () => void }) {
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  const { data, refetch } = useQuery(ClassroomPeopleDocument, { variables: { id: classroom.id }, fetchPolicy: 'cache-and-network' })
  const [invite] = useMutation(InviteToClassroomDocument)
  const [setRole] = useMutation(SetClassroomRoleDocument)
  const [remove] = useMutation(RemoveClassroomMemberDocument)
  const [person, setPerson] = useState('')
  const [chosen, setChosen] = useState<Member>()
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const send = async (role: 'STUDENT' | 'TA') => {
    const problem = await attempt(() => invite({ variables: { classroomId: classroom.id, person: person.trim(), role } }))
    setMessage(problem ? { ok: false, text: problem } : { ok: true, text: 'Invite sent. It lasts 14 days.' })
    if (!problem) setPerson('')
  }
  const act = async (fn: Run, done: string) => {
    const problem = await attempt(fn)
    setMessage(problem ? { ok: false, text: problem } : { ok: true, text: done })
    await refetch()
    onChanged()
  }
  return (
    <View className="gap-2">
      <View className="bg-card border-border gap-2 rounded-2xl border p-3">
        <TextInput accessibilityLabel="Handle or email" value={person} onChangeText={setPerson} placeholder="Invite by handle or email" placeholderTextColor={muted} autoCapitalize="none" autoCorrect={false} className="text-foreground py-1 text-base" />
        <View className="flex-row flex-wrap gap-2">
          <Action label="Invite as student" primary onPress={() => person.trim() && void send('STUDENT')} />
          {classroom.viewerCan.manage ? <Action label="Invite as TA" onPress={() => person.trim() && void send('TA')} /> : null}
        </View>
      </View>
      {message ? (
        <Text accessibilityRole={message.ok ? undefined : 'alert'} className={message.ok ? 'text-primary text-sm' : 'text-destructive text-sm'}>
          {message.text}
        </Text>
      ) : null}
      {(data?.classroom?.members ?? []).map((m) => (
        <View key={m.user.id} className="bg-card border-border flex-row items-center gap-3 rounded-2xl border p-3">
          <Pressable accessibilityRole="link" accessibilityLabel={m.user.displayName} onPress={() => router.push(`/u/${m.user.handle}`)} className="flex-1 flex-row items-center gap-3">
            <View className="bg-secondary size-9 items-center justify-center rounded-full">
              <Text className="text-secondary-foreground font-bold">{m.user.displayName.slice(0, 1).toUpperCase()}</Text>
            </View>
            <Text className="flex-1 font-semibold">{m.user.displayName}</Text>
            <Text className="text-muted-foreground text-xs">{CLASS_ROLE[m.role]}</Text>
          </Pressable>
          {classroom.viewerCan.manage && m.role !== 'TEACHER' ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Manage ${m.user.displayName}`} onPress={() => setChosen(m)} className="p-2">
              <MoreHorizontal size={20} color={muted} />
            </Pressable>
          ) : null}
        </View>
      ))}
      <ActionSheet
        name="class-member"
        title={chosen?.user.displayName}
        open={!!chosen}
        onClose={() => setChosen(undefined)}
        actions={
          chosen
            ? memberActions(
                classroom,
                chosen,
                {
                  setRole: (role) => () => setRole({ variables: { classroomId: classroom.id, userId: chosen.user.id, role } }),
                  remove: () => remove({ variables: { classroomId: classroom.id, userId: chosen.user.id } }),
                },
                (fn, done) => void act(fn, done),
              )
            : []
        }
      />
    </View>
  )
}

function Requests({ classroom, onChanged }: { classroom: ClassroomDetailFragment; onChanged: () => void }) {
  const { data, refetch } = useQuery(ClassroomPeopleDocument, { variables: { id: classroom.id }, fetchPolicy: 'cache-and-network' })
  const [review] = useMutation(ReviewClassroomJoinRequestDocument)
  const [error, setError] = useState<string | null>(null)
  const requests = data?.classroom?.joinRequests ?? []
  const decide = async (requestId: string, decision: 'APPROVED' | 'REJECTED') => {
    setError(await attempt(() => review({ variables: { requestId, decision } })))
    await refetch()
    onChanged()
  }
  if (!requests.length) return <Text className="text-muted-foreground py-6 text-center">No requests waiting.</Text>
  return (
    <View className="gap-2">
      {error ? (
        <Text accessibilityRole="alert" className="text-destructive text-sm">
          {error}
        </Text>
      ) : null}
      {requests.map((r) => (
        <View key={r.id} className="bg-card border-border gap-2 rounded-2xl border p-4">
          <Text className="font-semibold">{r.user.displayName}</Text>
          <Text className="text-muted-foreground text-xs">
            {r.via === 'LINK' ? 'with the link' : 'with the code'} · {ago(r.createdAt)}
          </Text>
          <View className="flex-row gap-2">
            <Action label="Let in" primary onPress={() => void decide(r.id, 'APPROVED')} />
            <Action label="Decline" onPress={() => void decide(r.id, 'REJECTED')} />
          </View>
        </View>
      ))}
    </View>
  )
}
