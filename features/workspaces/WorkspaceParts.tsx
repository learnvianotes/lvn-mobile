import { useMutation, useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { Award, ExternalLink, GitBranch, Lightbulb, MessageSquare, Star } from 'lucide-react-native'
import { useState } from 'react'
import { Linking, Pressable, TextInput, View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { PostComments } from '@/features/discussion/PostComments'
import { attempt, textToDoc } from '@/features/groups/shared'
import { STATE } from '@/features/moderation/copy'
import { ContentModeration } from '@/features/moderation/ModerationNotice'
import { ReportLink } from '@/features/moderation/ReportSheet'
import { RichDoc } from '@/features/notes/render/RichText'
import { Field, Outcome, Pill } from '@/features/shell/Form'
import { ago } from '@/features/notifications/describe'
import { AnswerMentorInviteDocument, AskDoubtDocument, CreateIdeaDocument, SetGroupRepositoryDocument, WorkspaceDocument, WorkspaceDoubtsDocument, WorkspaceIdeasDocument, type DoubtStatus, type GroupDetailFragment } from '@/graphql/generated/graphql'
import type { Doc } from '@/lib/contracts/validation'

export const STATUS: Record<DoubtStatus, string> = { OPEN: 'Open', ANSWERED: 'Answered', RESOLVED: 'Resolved' }

export function StatusChip({ status }: { status: DoubtStatus }) {
  const tone = status === 'RESOLVED' ? 'bg-emerald-100' : status === 'ANSWERED' ? 'bg-secondary' : 'bg-amber-100'
  return (
    <View className={`rounded-full px-2 py-0.5 ${tone}`}>
      <Text className="text-xs font-semibold text-black">{STATUS[status]}</Text>
    </View>
  )
}

/**
 * A workspace's header parts on the phone (lvn-backend ADR-0048): an open mentor invite to answer, the repository card
 * (opened in the browser; admins link, change or unlink it) and the showcase (chosen in Settings).
 */
export function WorkspaceHeader({ group, onChanged }: { group: GroupDetailFragment; onChanged: () => void }) {
  const accent = String(useCSSVariable('--color-primary') ?? '#4f46e5')
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  const { data, refetch } = useQuery(WorkspaceDocument, { variables: { id: group.id }, fetchPolicy: 'cache-and-network' })
  const [answer] = useMutation(AnswerMentorInviteDocument)
  const [error, setError] = useState<string | null>(null)
  const repo = data?.group?.repository
  const showcase = data?.group?.showcase
  const reply = async (accept: boolean) => {
    setError(await attempt(() => answer({ variables: { inviteId: group.viewerMentorInviteId!, accept } })))
    onChanged()
  }
  return (
    <View className="gap-2">
      {group.viewerMentorInviteId ? (
        <View className="border-primary gap-2 rounded-2xl border p-3">
          <Text className="text-sm">You&apos;ve been asked to mentor this project.</Text>
          <View className="flex-row gap-2">
            <Pressable accessibilityRole="button" onPress={() => void reply(true)} className="bg-primary rounded-full px-4 py-2">
              <Text className="text-primary-foreground font-semibold">Accept</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => void reply(false)} className="border-border rounded-full border px-4 py-2">
              <Text className="font-semibold">Decline</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {repo ? (
        <Pressable accessibilityRole="link" accessibilityLabel={`Repository ${repo.name ?? repo.url}`} onPress={() => void Linking.openURL(repo.url)} className="border-border gap-1 rounded-2xl border p-3">
          <View className="flex-row items-center gap-2">
            <GitBranch size={16} color={accent} />
            <Text className="flex-1 font-semibold" numberOfLines={1}>
              {repo.name ?? repo.url.replace(/^https:\/\//, '')}
            </Text>
            <ExternalLink size={14} color={muted} />
          </View>
          {repo.available ? (
            <>
              {repo.description ? <Text className="text-muted-foreground text-sm">{repo.description}</Text> : null}
              <View className="flex-row flex-wrap items-center gap-3">
                {repo.language ? <Text className="text-muted-foreground text-xs">{repo.language}</Text> : null}
                <View className="flex-row items-center gap-1">
                  <Star size={12} color={muted} />
                  <Text className="text-muted-foreground text-xs">{repo.stars === 1 ? '1 star' : `${repo.stars ?? 0} stars`}</Text>
                </View>
                {repo.pushedAt ? <Text className="text-muted-foreground text-xs">updated {ago(repo.pushedAt)}</Text> : null}
              </View>
            </>
          ) : (
            <Text className="text-muted-foreground text-xs">Only the link: the provider doesn&apos;t show this repository&apos;s details publicly.</Text>
          )}
        </Pressable>
      ) : null}
      {group.viewerCan.manage && data?.group ? <RepositoryEditor groupId={group.id} url={repo?.url ?? null} onChanged={() => void refetch()} /> : null}
      {showcase ? (
        <Pressable accessibilityRole="link" onPress={() => router.push(`/notes/${showcase.id}`)} className="flex-row items-center gap-1.5 self-start">
          <Award size={16} color={accent} />
          <Text className="text-primary font-semibold">Showcase: {showcase.title || 'Untitled note'}</Text>
        </Pressable>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" className="text-destructive text-sm">
          {error}
        </Text>
      ) : null}
    </View>
  )
}

/** Admins link a public GitHub or GitLab repository, change it or unlink it; LearnViaNotes never needs access. */
function RepositoryEditor({ groupId, url, onChanged }: { groupId: string; url: string | null; onChanged: () => void }) {
  const [save, saving] = useMutation(SetGroupRepositoryDocument)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(url ?? '')
  const [error, setError] = useState<string | null>(null)
  const submit = async (next: string | null) => {
    const problem = await attempt(() => save({ variables: { groupId, url: next } }))
    setError(problem)
    if (!problem) setEditing(false)
    onChanged()
  }
  if (!editing)
    return (
      <View className="gap-1">
        {url ? null : <Text className="text-muted-foreground text-sm">No repository linked yet.</Text>}
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setValue(url ?? '')
            setEditing(true)
          }}
          className="self-start py-1"
        >
          <Text className="text-primary text-sm font-semibold">{url ? 'Change repository' : 'Link a repository'}</Text>
        </Pressable>
      </View>
    )
  return (
    <View className="border-border gap-2 rounded-2xl border p-3">
      <Field label="Repository address" hint="A repository on github.com or gitlab.com. LearnViaNotes shows its public details; it never needs access." placeholder="https://github.com/owner/project" value={value} onChangeText={setValue} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
      <View className="flex-row flex-wrap gap-2">
        <Pill label="Save" primary disabled={saving.loading || !value.trim()} onPress={() => void submit(value.trim())} />
        {url ? <Pill label="Unlink" onPress={() => void submit(null)} /> : null}
        <Pill label="Cancel" onPress={() => setEditing(false)} />
      </View>
      <Outcome message={error ? { ok: false, text: error } : null} />
    </View>
  )
}

/** The ideas board (ADR-0048): ranked by the team's reactions; react and discuss under each. */
export function Ideas({ group }: { group: GroupDetailFragment }) {
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  const { data, refetch } = useQuery(WorkspaceIdeasDocument, { variables: { id: group.id }, fetchPolicy: 'cache-and-network' })
  const [create] = useMutation(CreateIdeaDocument)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const ideas = data?.group?.ideas ?? []
  return (
    <View className="gap-3">
      {group.viewerCan.post ? (
        <View className="bg-card border-border gap-2 rounded-2xl border p-3">
          <TextInput accessibilityLabel="Share an idea" value={text} onChangeText={setText} placeholder="An idea for the project…" placeholderTextColor={muted} multiline className="text-foreground min-h-12" />
          <Pressable
            accessibilityRole="button"
            disabled={!text.trim()}
            onPress={() =>
              void attempt(async () => {
                const res = await create({ variables: { groupId: group.id, body: textToDoc(text) } })
                if (res.data?.createGroupPost.post) setText('')
                return res
              }).then((p) => {
                setError(p)
                void refetch()
              })
            }
            className={`self-end rounded-full px-4 py-2 ${text.trim() ? 'bg-primary' : 'bg-muted'}`}
          >
            <Text className="text-primary-foreground font-semibold">Share idea</Text>
          </Pressable>
        </View>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" className="text-destructive text-sm">
          {error}
        </Text>
      ) : null}
      <Text className="text-muted-foreground text-xs">The ideas the team reacts to most come first.</Text>
      {ideas.length ? (
        ideas.map((idea, i) => (
          <View key={idea.id} className="bg-card border-border gap-2 rounded-2xl border p-4">
            <View className="flex-row items-center gap-2">
              <Text accessibilityLabel={`Rank ${i + 1}`} className="text-primary font-bold">
                {i + 1}
              </Text>
              <Lightbulb size={14} color="#f59e0b" />
              <Text className="font-semibold">{idea.author.displayName}</Text>
              <Text className="text-muted-foreground flex-1 text-xs">{ago(idea.createdAt)}</Text>
              <ReportLink icon entityType="GROUP_POST" entityId={idea.id} authorId={idea.author.id} />
            </View>
            <ContentModeration entityType="GROUP_POST" item={idea} onAppealed={() => void refetch()} />
            <RichDoc doc={idea.body as Doc} />
            <PostComments type="GROUP_POST" id={idea.id} count={idea.discussion.commentCount} />
          </View>
        ))
      ) : data ? (
        <Text className="text-muted-foreground py-6 text-center">No ideas yet.</Text>
      ) : null}
    </View>
  )
}

/** Doubts (ADR-0048): ask one, filter by status, open one to answer. */
export function Doubts({ group }: { group: GroupDetailFragment }) {
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  const [status, setStatus] = useState<DoubtStatus | null>(null)
  const { data } = useQuery(WorkspaceDoubtsDocument, { variables: { id: group.id, status }, fetchPolicy: 'cache-and-network' })
  const [ask] = useMutation(AskDoubtDocument)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [repoRef, setRepoRef] = useState('')
  const [error, setError] = useState<string | null>(null)
  const doubts = data?.group?.doubts?.edges.map((e) => e.node) ?? []
  const submit = async () => {
    let id: string | undefined
    const problem = await attempt(async () => {
      const res = await ask({ variables: { input: { groupId: group.id, title, body: textToDoc(body), repoRef: repoRef.trim() || null } } })
      id = res.data?.askDoubt.doubt?.id
      return res
    })
    if (problem) return setError(problem)
    setOpen(false)
    if (id) router.push(`/groups/${group.id}/doubts/${id}`)
  }
  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap gap-2">
        {([null, 'OPEN', 'ANSWERED', 'RESOLVED'] as const).map((f) => (
          <Pressable key={f ?? 'ALL'} accessibilityRole="button" accessibilityState={{ selected: status === f }} onPress={() => setStatus(f)} className={`rounded-full px-3 py-1.5 ${status === f ? 'bg-primary' : 'border-border border'}`}>
            <Text className={status === f ? 'text-primary-foreground text-xs font-semibold' : 'text-xs font-semibold'}>{f ? STATUS[f] : 'All'}</Text>
          </Pressable>
        ))}
      </View>
      {group.viewerCan.askDoubt && !open ? (
        <Pressable accessibilityRole="button" onPress={() => setOpen(true)} className="bg-primary self-start rounded-full px-4 py-2">
          <Text className="text-primary-foreground font-semibold">Ask a doubt</Text>
        </Pressable>
      ) : null}
      {open ? (
        <View className="bg-card border-border gap-2 rounded-2xl border p-3">
          <TextInput accessibilityLabel="Your question" value={title} onChangeText={setTitle} placeholder="Your question" placeholderTextColor={muted} maxLength={200} className="border-border text-foreground rounded-xl border px-3 py-2" />
          <TextInput accessibilityLabel="Details" value={body} onChangeText={setBody} placeholder="Details" placeholderTextColor={muted} multiline className="border-border text-foreground min-h-16 rounded-xl border px-3 py-2" />
          <TextInput accessibilityLabel="Where in the repository" value={repoRef} onChangeText={setRepoRef} placeholder="Where in the repository (optional)" placeholderTextColor={muted} autoCapitalize="none" maxLength={300} className="border-border text-foreground rounded-xl border px-3 py-2" />
          <View className="flex-row justify-end gap-2">
            <Pressable accessibilityRole="button" onPress={() => setOpen(false)} className="border-border rounded-full border px-4 py-2">
              <Text className="font-semibold">Cancel</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={!title.trim() || !body.trim()} onPress={() => void submit()} className={`rounded-full px-4 py-2 ${title.trim() && body.trim() ? 'bg-primary' : 'bg-muted'}`}>
              <Text className="text-primary-foreground font-semibold">Ask</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" className="text-destructive text-sm">
          {error}
        </Text>
      ) : null}
      {doubts.length ? (
        doubts.map((d) => (
          <Pressable key={d.id} accessibilityRole="link" accessibilityLabel={d.title} onPress={() => router.push(`/groups/${group.id}/doubts/${d.id}`)} className="bg-card border-border gap-1.5 rounded-2xl border p-4">
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="flex-1 font-semibold">{d.title}</Text>
              <StatusChip status={d.status} />
              {d.moderation !== 'OK' ? <Text className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">{STATE[d.moderation]}</Text> : null}
            </View>
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="text-muted-foreground text-xs">
                {d.author.displayName} · {ago(d.createdAt)}
              </Text>
              <MessageSquare size={12} color={muted} />
              <Text className="text-muted-foreground text-xs">{d.answerCount === 1 ? '1 answer' : `${d.answerCount} answers`}</Text>
            </View>
          </Pressable>
        ))
      ) : data ? (
        <Text className="text-muted-foreground py-6 text-center">No doubts here.</Text>
      ) : null}
    </View>
  )
}
