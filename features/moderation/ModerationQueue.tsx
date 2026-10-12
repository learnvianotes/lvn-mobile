import { useMutation, useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, TextInput, View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { attempt } from '@/features/groups/shared'
import { ago } from '@/features/notifications/describe'
import { ModerateContentDocument, ModerationQueueDocument, MuteGroupMemberDocument, type ModerationActionType, type ModerationQueueQuery } from '@/graphql/generated/graphql'
import { ENTITY, REASON_LABEL, STATE } from './copy'

type Case = ModerationQueueQuery['moderationQueue']['edges'][number]['node']
type Choice = { action: ModerationActionType; label: string }

const NEEDS_REASON = new Set<ModerationActionType>(['HIDE', 'REMOVE', 'WARN'])

/** What a group's moderators or a class's staff can do with a case; approving content that is up changes nothing. */
function choicesFor(c: Case): Choice[] {
  const state = c.content?.moderation
  const keep = !!c.appeal && (state === 'HIDDEN' || state === 'REMOVED')
  const rest: Choice[] = [
    { action: 'DISMISS', label: keep ? 'Keep the decision' : 'Dismiss reports' },
    { action: 'WARN', label: 'Warn' },
    { action: 'HIDE', label: 'Hide' },
    { action: 'REMOVE', label: 'Remove' },
  ]
  return state && state !== 'OK' ? [{ action: 'APPROVE', label: keep ? 'Put it back' : 'Approve' }, ...rest] : rest
}

/**
 * A group's or a class's reports on the phone (lvn-backend ADR-0051), oldest first: what was reported and why, the
 * author's appeal, and the decisions. In a group, its moderators can also mute the author for a day.
 */
export function ModerationQueue({ scope, groupId }: { scope: { scope: 'GROUP' | 'CLASSROOM'; id: string }; groupId?: string }) {
  const { data, refetch } = useQuery(ModerationQueueDocument, { variables: { scope }, fetchPolicy: 'cache-and-network' })
  const cases = data?.moderationQueue.edges.map((e) => e.node) ?? []
  return (
    <View className="gap-3">
      <Text className="text-muted-foreground text-sm">
        {scope.scope === 'GROUP' ? 'Reports from members and posts held for review, oldest first. Only the group’s moderators see them.' : 'Reports from the class and comments held for review, oldest first. Only the teacher and TAs see them.'}
      </Text>
      {data && !cases.length ? <Text className="text-muted-foreground py-8 text-center">Nothing to review. Thank you!</Text> : null}
      {cases.map((c) => (
        <CaseCard key={`${c.entityType}:${c.entityId}`} item={c} groupId={groupId} onDone={() => void refetch()} />
      ))}
    </View>
  )
}

function CaseCard({ item: c, groupId, onDone }: { item: Case; groupId?: string; onDone: () => void }) {
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  const [moderate, deciding] = useMutation(ModerateContentDocument)
  const [mute] = useMutation(MuteGroupMemberDocument)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [muted24, setMuted24] = useState(false)
  const author = c.content?.author ?? c.note?.owner ?? null
  const decide = async (action: ModerationActionType) => {
    if (NEEDS_REASON.has(action) && !reason.trim()) return setError('Write a reason first: the author is told.')
    const problem = await attempt(() => moderate({ variables: { input: { entityType: c.entityType, entityId: c.entityId, action, reason: reason.trim() || null } } }))
    setError(problem)
    if (!problem) onDone()
  }
  const muteAuthor = async () => {
    if (!groupId || !c.content) return
    const problem = await attempt(() => mute({ variables: { groupId, userId: c.content!.author.id, until: new Date(Date.now() + 86_400_000).toISOString() } }))
    setError(problem)
    if (!problem) setMuted24(true)
  }
  return (
    <View accessibilityLabel={`${ENTITY[c.entityType]} case`} className="bg-card border-border gap-3 rounded-2xl border p-4">
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className="text-muted-foreground text-xs font-semibold uppercase">{ENTITY[c.entityType]}</Text>
        {c.content ? <Text className="bg-secondary rounded-full px-2 py-0.5 text-xs">{STATE[c.content.moderation]}</Text> : null}
        <Text className="text-muted-foreground ml-auto text-xs">opened {ago(c.openedAt)}</Text>
      </View>
      {author ? (
        <Text className="text-sm">
          by <Text className="font-semibold">{author.displayName}</Text> (@{author.handle})
        </Text>
      ) : null}
      {c.content ? (
        <View className="bg-secondary gap-1 rounded-xl px-3 py-2">
          <Text className="text-sm" numberOfLines={6}>
            {c.content.deleted ? 'The author has deleted it.' : c.content.excerpt}
          </Text>
          <Pressable accessibilityRole="link" onPress={() => router.push(c.content!.path as never)}>
            <Text className="text-primary text-xs font-semibold">Open where it is</Text>
          </Pressable>
        </View>
      ) : null}
      {c.reports.map((r, i) => (
        <Text key={i} className="text-sm">
          <Text className="font-semibold">{REASON_LABEL[r.reason]}</Text> · {r.reporter ? r.reporter.displayName : 'held automatically'}
          {r.details ? `\n${r.details}` : ''}
        </Text>
      ))}
      {c.appeal ? (
        <View className="border-primary bg-primary/10 rounded-xl border-l-4 px-3 py-2">
          <Text className="text-primary text-xs font-semibold uppercase">The author’s appeal</Text>
          <Text className="text-sm">{c.appeal.message}</Text>
        </View>
      ) : null}
      <TextInput accessibilityLabel="Reason (the author sees it)" placeholder="Needed to hide, remove or warn" placeholderTextColor={muted} value={reason} onChangeText={setReason} maxLength={1000} className="border-border text-foreground rounded-xl border px-3 py-2" />
      <View className="flex-row flex-wrap gap-2">
        {choicesFor(c).map(({ action, label }) => (
          <Pressable key={action} accessibilityRole="button" disabled={deciding.loading} onPress={() => void decide(action)} className={`rounded-full px-3 py-2 ${action === 'APPROVE' ? 'bg-primary' : 'border-border border'}`}>
            <Text className={`text-sm font-semibold ${action === 'APPROVE' ? 'text-primary-foreground' : action === 'REMOVE' ? 'text-destructive' : ''}`}>{label}</Text>
          </Pressable>
        ))}
        {groupId && c.content ? (
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: muted24 }} disabled={muted24} onPress={() => void muteAuthor()} className="rounded-full px-3 py-2">
            <Text className="text-muted-foreground text-sm font-semibold">{muted24 ? 'Muted for a day' : 'Mute the author for a day'}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text accessibilityRole="alert" className="text-destructive text-sm">
          {error}
        </Text>
      ) : null}
    </View>
  )
}
