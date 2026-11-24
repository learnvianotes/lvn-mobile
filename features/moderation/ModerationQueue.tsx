import { CombinedGraphQLErrors } from '@apollo/client/errors'
import { useMutation, useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, TextInput, View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { attempt } from '@/features/groups/shared'
import { ago } from '@/features/notifications/describe'
import { ModerateContentDocument, ModerationQueueDocument, MuteGroupMemberDocument, type ModerationActionType, type ModerationQueueQuery } from '@/graphql/generated/graphql'
import { TYPE_LABEL } from '@/features/resources/copy'
import { openInBrowser } from '@/lib/open-external'
import { ENTITY, REASON_LABEL, STATE } from './copy'

type Case = ModerationQueueQuery['moderationQueue']['edges'][number]['node']
type Choice = { action: ModerationActionType; label: string }

const NEEDS_REASON = new Set<ModerationActionType>(['HIDE', 'REMOVE', 'WARN', 'SUSPEND'])
/** How long a suspension lasts, in days (ADR-0053: 1 to 365). */
const SUSPEND_DAYS = [1, 3, 7, 30, 90, 365] as const

/** What a moderator can do with a case, as on the web: accounts are warned, groups removed; content that is up has nothing to approve. */
function choicesFor(c: Case): Choice[] {
  const state = c.content?.moderation ?? c.note?.moderation
  const keep = !!c.appeal && (state === 'HIDDEN' || state === 'REMOVED')
  const dismiss: Choice = { action: 'DISMISS', label: keep ? 'Keep the decision' : 'Dismiss reports' }
  const warn: Choice = { action: 'WARN', label: 'Warn' }
  const remove: Choice = { action: 'REMOVE', label: 'Remove' }
  // A new resource is approved or rejected (ADR-0074); people's reports on one in the catalogue are dismissed, or it is removed.
  if (c.entityType === 'RESOURCE') return c.reports.some((x) => x.reporter) ? [dismiss, remove] : [{ action: 'APPROVE', label: 'Approve' }, { action: 'REMOVE', label: 'Reject' }]
  // Accounts are warned or suspended; a suspension is lifted or kept (ADR-0053).
  if (c.entityType === 'USER') return c.suspendedUntil ? [{ action: 'APPROVE', label: 'Lift the suspension' }, { action: 'DISMISS', label: c.appeal ? 'Keep the decision' : 'Dismiss reports' }, warn] : [dismiss, warn, { action: 'SUSPEND', label: 'Suspend' }]
  // A removed group is put back or stays removed.
  if (c.entityType === 'GROUP') return c.removedGroup ? [{ action: 'APPROVE', label: 'Put it back' }, { action: 'DISMISS', label: 'Keep the decision' }] : [dismiss, warn, remove]
  const rest: Choice[] = [dismiss, warn, { action: 'HIDE', label: 'Hide' }, remove]
  return state && state !== 'OK' ? [{ action: 'APPROVE', label: keep ? 'Put it back' : 'Approve' }, ...rest] : rest
}

const WHERE: Record<string, string> = { GROUP: 'In a group', CLASSROOM: 'In a class' }

/**
 * A moderation queue on the phone (lvn-backend ADR-0037, ADR-0051), oldest first: what was reported and why, the
 * author's appeal, and the decisions. With `scope` it is a group's (its moderators can also mute the author for a day)
 * or a class's; without, the platform's, for platform admins, with every scope's cases marked by where they are.
 */
export function ModerationQueue({ scope, groupId }: { scope?: { scope: 'GROUP' | 'CLASSROOM'; id: string }; groupId?: string }) {
  const { data, error, refetch, fetchMore } = useQuery(ModerationQueueDocument, { variables: { scope }, fetchPolicy: 'cache-and-network' })
  const cases = data?.moderationQueue.edges.map((e) => e.node) ?? []
  const forbidden = CombinedGraphQLErrors.is(error) && error.errors.some((e) => e.extensions?.code === 'FORBIDDEN')
  if (forbidden) return <Text className="text-muted-foreground py-8 text-center">{scope ? 'Only the moderators of this place see its reports.' : 'The moderation queue is for platform admins.'}</Text>
  return (
    <View className="gap-3">
      <Text className="text-muted-foreground text-sm">
        {!scope
          ? 'Open reports and appeals from everywhere, oldest first. Notes held on their way to the public are here too.'
          : scope.scope === 'GROUP'
            ? 'Reports from members and posts held for review, oldest first. Only the group’s moderators see them.'
            : 'Reports from the class and comments held for review, oldest first. Only the teacher and TAs see them.'}
      </Text>
      {data && !cases.length ? <Text className="text-muted-foreground py-8 text-center">Nothing to review. Thank you!</Text> : null}
      {cases.map((c) => (
        <CaseCard key={`${c.entityType}:${c.entityId}`} item={c} groupId={groupId} platform={!scope} onDone={() => void refetch()} />
      ))}
      {data?.moderationQueue.pageInfo.hasNextPage ? (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            void fetchMore({
              variables: { after: data.moderationQueue.pageInfo.endCursor },
              updateQuery: (prev, { fetchMoreResult }) => ({ moderationQueue: { ...fetchMoreResult.moderationQueue, edges: [...prev.moderationQueue.edges, ...fetchMoreResult.moderationQueue.edges] } }),
            })
          }
          className="border-border self-center rounded-full border px-4 py-2"
        >
          <Text className="font-semibold">Show more</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

function CaseCard({ item: c, groupId, platform, onDone }: { item: Case; groupId?: string; platform?: boolean; onDone: () => void }) {
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#66625b')
  const [moderate, deciding] = useMutation(ModerateContentDocument)
  const [mute] = useMutation(MuteGroupMemberDocument)
  const [reason, setReason] = useState('')
  const [days, setDays] = useState<number>(7)
  const [error, setError] = useState<string | null>(null)
  const [muted24, setMuted24] = useState(false)
  const author = c.content?.author ?? c.note?.owner ?? null
  const state = c.content?.moderation ?? c.note?.moderation ?? null
  const title = c.note ? c.note.title || 'Untitled note' : c.resource ? c.resource.title : c.group ? c.group.name : c.removedGroup ? c.removedGroup.name : c.user ? `${c.user.displayName} (@${c.user.handle})` : null
  const decide = async (action: ModerationActionType) => {
    if (NEEDS_REASON.has(action) && !reason.trim()) return setError('Write a reason first: the author is told.')
    const problem = await attempt(() => moderate({ variables: { input: { entityType: c.entityType, entityId: c.entityId, action, reason: reason.trim() || null, ...(action === 'SUSPEND' ? { suspendDays: days } : {}) } } }))
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
        <Text className="text-muted-foreground text-xs font-semibold">{ENTITY[c.entityType]}</Text>
        {platform && c.scope !== 'PLATFORM' ? <Text className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-semibold">{WHERE[c.scope]}</Text> : null}
        {state ? <Text className="bg-secondary rounded-full px-2 py-0.5 text-xs">{STATE[state]}</Text> : null}
        {c.suspendedUntil ? <Text className="rounded-full bg-rose-soft px-2 py-0.5 text-xs font-semibold text-destructive">Suspended until {new Date(c.suspendedUntil).toLocaleDateString()}</Text> : null}
        {c.removedGroup ? <Text className="rounded-full bg-rose-soft px-2 py-0.5 text-xs font-semibold text-destructive">Removed</Text> : null}
        <Text className="text-muted-foreground ml-auto text-xs">opened {ago(c.openedAt)}</Text>
      </View>
      {title ? (
        c.group ? (
          <Pressable accessibilityRole="link" onPress={() => router.push(`/groups/${c.group!.id}`)}>
            <Text className="text-lg font-semibold">{title}</Text>
          </Pressable>
        ) : (
          <Text className="text-lg font-semibold">{title}</Text>
        )
      ) : null}
      {author ? (
        <Text className="text-sm">
          by <Text className="font-semibold">{author.displayName}</Text> (@{author.handle})
        </Text>
      ) : null}
      {c.removedGroup ? <Text className="bg-secondary rounded-xl px-3 py-2 text-sm">Removed: {c.removedGroup.reason}</Text> : null}
      {c.resource ? <ResourceCase resource={c.resource} /> : null}
      {c.note?.excerpt ? (
        <Text className="bg-secondary rounded-xl px-3 py-2 text-sm" numberOfLines={6}>
          {c.note.excerpt}
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
          <Text className="text-primary text-xs font-semibold">The author’s appeal</Text>
          <Text className="text-sm">{c.appeal.message}</Text>
        </View>
      ) : null}
      <TextInput accessibilityLabel="Reason (the author sees it)" placeholder="Needed to hide, remove or warn" placeholderTextColor={muted} value={reason} onChangeText={setReason} maxLength={1000} className="border-border text-foreground rounded-xl border px-3 py-2" />
      {choicesFor(c).some((x) => x.action === 'SUSPEND') ? (
        <View className="gap-1.5" accessibilityRole="radiogroup" accessibilityLabel="Suspend for">
          <Text className="text-muted-foreground text-xs font-semibold">Suspend for</Text>
          <View className="flex-row flex-wrap gap-2">
            {SUSPEND_DAYS.map((d) => (
              <Pressable key={d} accessibilityRole="radio" accessibilityState={{ checked: days === d }} accessibilityLabel={d === 1 ? '1 day' : `${d} days`} onPress={() => setDays(d)} className={`rounded-full px-3 py-1.5 ${days === d ? 'bg-primary' : 'border-border border'}`}>
                <Text className={`text-xs font-semibold ${days === d ? 'text-primary-foreground' : ''}`}>{d === 1 ? '1 day' : `${d} days`}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      <View className="flex-row flex-wrap gap-2">
        {choicesFor(c).map(({ action, label }) => (
          <Pressable key={action} accessibilityRole="button" disabled={deciding.loading} onPress={() => void decide(action)} className={`rounded-full px-3 py-2 ${action === 'APPROVE' ? 'bg-primary' : 'border-border border'}`}>
            <Text className={`text-sm font-semibold ${action === 'APPROVE' ? 'text-primary-foreground' : action === 'REMOVE' || action === 'SUSPEND' ? 'text-destructive' : ''}`}>{label}</Text>
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

/** What moderators judge a resource by (ADR-0074): what it is, where its link goes, and what the person said about it. */
function ResourceCase({ resource: r }: { resource: NonNullable<Case['resource']> }) {
  return (
    <View className="bg-secondary gap-1 rounded-xl px-3 py-2">
      <Text className="text-sm">
        <Text className="font-semibold">{TYPE_LABEL[r.type]}</Text>
        {r.author ? ` · ${r.author}` : ''}
        {r.isbn ? ` · ISBN ${r.isbn}` : ''} · by {r.submittedBy.displayName}
      </Text>
      <Pressable accessibilityRole="link" onPress={() => openInBrowser(r.url)}>
        <Text className="text-primary text-sm font-semibold">{r.url}</Text>
      </Pressable>
      {r.description ? (
        <Text className="text-sm" numberOfLines={6}>
          {r.description}
        </Text>
      ) : null}
    </View>
  )
}
