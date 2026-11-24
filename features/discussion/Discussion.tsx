import { useMutation, useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { Lock, MessageSquare } from 'lucide-react-native'
import { useState } from 'react'
import { Alert, Pressable, TextInput, View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { attempt, docToText, textToDoc } from '@/features/groups/shared'
import { RichDoc } from '@/features/notes/render/RichText'
import { LoadState } from '@/features/shell/LoadState'
import { ago } from '@/features/notifications/describe'
import { AddCommentDocument, ApproveCommentDocument, DeleteCommentDocument, DiscussionDocument, EditCommentDocument, type CommentFieldsFragment, type CommentTargetType } from '@/graphql/generated/graphql'
import type { Doc } from '@/lib/contracts/validation'
import { ReactionBar } from './Reactions'
import { ContentModeration } from '@/features/moderation/ModerationNotice'
import { ReportLink } from '@/features/moderation/ReportSheet'

/**
 * A discussion on the phone (lvn-backend ADR-0047): reactions, comments with one level of replies, and what the viewer
 * may do with each, editing one's own included. Read with its own query, so threads stay within the depth limit.
 */
export function Discussion({ target, compact }: { target: { type: CommentTargetType; id: string }; compact?: boolean }) {
  const accent = String(useCSSVariable('--color-primary') ?? '#2847a8')
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#66625b')
  const thread = useQuery(DiscussionDocument, { variables: { target }, fetchPolicy: 'cache-and-network' })
  const { data, refetch } = thread
  const [add] = useMutation(AddCommentDocument)
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const d = data?.discussion
  if (!d) return data ? null : <LoadState query={thread} inline message="The discussion could not load." />
  const refresh = () => void refetch()
  const send = async () => {
    const problem = await attempt(() => add({ variables: { input: { target, body: textToDoc(text), ...(replyTo ? { parentId: replyTo } : {}) } } }))
    setError(problem)
    if (!problem) {
      setText('')
      setReplyTo(null)
    }
    refresh()
  }
  const comments = d.comments.edges.map((e) => e.node)
  const replying = comments.find((c) => c.id === replyTo)
  return (
    <View accessibilityLabel="Discussion" className={compact ? 'gap-3' : 'bg-card border-border gap-3 rounded-3xl border p-4'}>
      {compact ? null : (
        <View className="flex-row items-center gap-2">
          <MessageSquare size={18} color={accent} />
          <Text className="flex-1 text-lg font-semibold" accessibilityRole="header">
            Discussion
          </Text>
          {d.commentCount ? <Text className="text-muted-foreground text-sm">{d.commentCount === 1 ? '1 comment' : `${d.commentCount} comments`}</Text> : null}
        </View>
      )}
      {/* Resources are saved rather than liked (lvn-backend ADR-0075): their discussion has comments only. */}
      {target.type === 'RESOURCE' ? null : <ReactionBar target={{ type: target.type, id: target.id }} reactions={d.reactions} disabled={!d.viewerCanComment} onChanged={refresh} />}
      {comments.length ? (
        comments.map((c) => (
          <View key={c.id} className="gap-2">
            <CommentView comment={c} onChanged={refresh} onReply={c.viewerCan.reply ? () => setReplyTo(c.id) : undefined} />
            {c.replies.length ? (
              <View className="border-border ml-4 gap-2 border-l-2 pl-3">
                {c.replies.map((r) => (
                  <CommentView key={r.id} comment={r} onChanged={refresh} />
                ))}
              </View>
            ) : null}
          </View>
        ))
      ) : (
        <Text className="text-muted-foreground text-sm">No comments yet.</Text>
      )}
      {d.viewerCanComment ? (
        <View className="gap-2">
          {replying ? (
            <View className="flex-row items-center gap-2">
              <Text className="text-muted-foreground flex-1 text-xs">Replying to {replying.author?.displayName ?? 'a comment'}</Text>
              <Pressable accessibilityRole="button" onPress={() => setReplyTo(null)}>
                <Text className="text-primary text-xs font-semibold">Cancel reply</Text>
              </Pressable>
            </View>
          ) : null}
          <TextInput
            accessibilityLabel={replyTo ? 'Write a reply' : 'Write a comment'}
            value={text}
            onChangeText={setText}
            placeholder={target.type === 'CLASSROOM_POST' && !replyTo ? "Ask the teacher a question. Only you and the class's staff see it." : 'Add a comment…'}
            placeholderTextColor={muted}
            multiline
            maxLength={5000}
            className="border-border text-foreground min-h-12 rounded-xl border px-3 py-2"
          />
          <View className="flex-row items-center justify-between gap-2">
            <Text className="text-muted-foreground flex-1 text-xs">Type @ and someone’s handle to mention them.</Text>
            <Pressable accessibilityRole="button" disabled={!text.trim()} onPress={() => void send()} className={`rounded-full px-4 py-2 ${text.trim() ? 'bg-primary' : 'bg-muted'}`}>
              <Text className="text-primary-foreground font-semibold">{replyTo ? 'Reply' : 'Comment'}</Text>
            </Pressable>
          </View>
        </View>
      ) : d.whyNot ? (
        <Text className="text-muted-foreground text-sm">{d.whyNot}</Text>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" className="text-destructive text-sm">
          {error}
        </Text>
      ) : null}
    </View>
  )
}

function CommentView({ comment: c, onChanged, onReply }: { comment: CommentFieldsFragment; onChanged: () => void; onReply?: () => void }) {
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#66625b')
  const [remove] = useMutation(DeleteCommentDocument)
  const [approve] = useMutation(ApproveCommentDocument)
  const [edit] = useMutation(EditCommentDocument)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const run = async (fn: () => Promise<{ data?: unknown }>) => {
    const problem = await attempt(fn)
    setError(problem)
    onChanged()
    return problem
  }
  if (c.removed) return <Text className="bg-secondary text-muted-foreground rounded-2xl px-3 py-2 text-sm italic">This comment was removed.</Text>
  return (
    <View className={`gap-1.5 rounded-2xl border px-3 py-2.5 ${c.pendingApproval ? 'border-dashed border-warm' : 'border-border'}`}>
      <View className="flex-row flex-wrap items-center gap-2">
        {c.author ? (
          <Pressable accessibilityRole="link" onPress={() => router.push(`/u/${c.author!.handle}`)}>
            <Text className="font-semibold">{c.author.displayName}</Text>
          </Pressable>
        ) : null}
        <Text className="text-muted-foreground text-xs">
          {ago(c.createdAt)}
          {c.editedAt ? ' · edited' : ''}
        </Text>
        {c.private ? (
          <View className="bg-secondary flex-row items-center gap-1 rounded-full px-2 py-0.5">
            <Lock size={11} color={muted} />
            <Text className="text-muted-foreground text-xs">Private thread</Text>
          </View>
        ) : null}
        {c.pendingApproval ? <Text className="text-xs text-warm">Waiting for approval</Text> : null}
      </View>
      <ContentModeration entityType="COMMENT" item={c} onAppealed={onChanged} />
      {editing ? (
        <View className="gap-2">
          <TextInput accessibilityLabel="Edit your comment" value={draft} onChangeText={setDraft} multiline maxLength={5000} autoFocus className="border-border text-foreground min-h-12 rounded-xl border px-3 py-2" />
          <View className="flex-row justify-end gap-4">
            <Pressable accessibilityRole="button" onPress={() => setEditing(false)}>
              <Text className="text-muted-foreground text-sm font-semibold">Cancel</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={!draft.trim()} onPress={() => void run(() => edit({ variables: { commentId: c.id, body: textToDoc(draft) } })).then((problem) => !problem && setEditing(false))}>
              <Text className={`text-sm font-semibold ${draft.trim() ? 'text-primary' : 'text-muted-foreground'}`}>Save</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <RichDoc doc={c.body as Doc} mentions />
      )}
      <View className="flex-row flex-wrap items-center gap-3">
        <ReactionBar target={{ type: 'COMMENT', id: c.id }} reactions={c.reactions} disabled={c.pendingApproval} onChanged={onChanged} />
        <View className="ml-auto flex-row gap-4">
          {onReply ? (
            <Pressable accessibilityRole="button" onPress={onReply}>
              <Text className="text-muted-foreground text-xs font-semibold">Reply</Text>
            </Pressable>
          ) : null}
          {c.viewerCan.edit && !editing ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit comment"
              onPress={() => {
                setDraft(docToText(c.body))
                setEditing(true)
              }}
            >
              <Text className="text-muted-foreground text-xs font-semibold">Edit</Text>
            </Pressable>
          ) : null}
          {c.viewerCan.approve ? (
            <Pressable accessibilityRole="button" onPress={() => void run(() => approve({ variables: { commentId: c.id } }))}>
              <Text className="text-primary text-xs font-semibold">Approve</Text>
            </Pressable>
          ) : null}
          {c.viewerCan.delete ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete comment"
              onPress={() =>
                Alert.alert('Delete this comment?', undefined, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => void run(() => remove({ variables: { commentId: c.id } })) },
                ])
              }
            >
              <Text className="text-muted-foreground text-xs font-semibold">Delete</Text>
            </Pressable>
          ) : null}
          {c.author ? <ReportLink entityType="COMMENT" entityId={c.id} authorId={c.author.id} /> : null}
        </View>
      </View>
      {error ? (
        <Text accessibilityRole="alert" className="text-destructive text-sm">
          {error}
        </Text>
      ) : null}
    </View>
  )
}
