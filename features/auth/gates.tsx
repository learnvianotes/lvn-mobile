import { useQuery } from '@apollo/client/react'
import { Text } from '@/components/ui/text'
import { UnverifiedGatedActionsDocument, ViewerDocument } from '@/graphql/generated/graphql'

/**
 * Names `unverifiedGatedActions` returns (contracts permissions). Changing visibility is not one of them;
 * Public follows `publicNotesRequireVerification`.
 */
export const GATED = {
  publish: 'note.publish',
  share: 'note.share',
  contest: 'contest.enter',
  payout: 'payout.request',
  aiBulk: 'ai.bulk',
  submitResource: 'resource.submit',
} as const

const EXPLAINED: readonly [string, string][] = [
  [GATED.publish, 'publishing a note'],
  [GATED.share, 'sharing a note'],
  [GATED.contest, 'entering a contest'],
  [GATED.payout, 'requesting a payout'],
  [GATED.aiBulk, 'running bulk Nova requests'],
  [GATED.submitResource, 'submitting a resource'],
]

type VerifyViewer = { globalRole: string; viewerNeedsVerification?: boolean | null }

/**
 * Whether this account should see verify prompts. A boolean `viewerNeedsVerification` decides
 * (false for a platform admin). Null, or a response from before that field, falls back to the role.
 */
export function needsVerifyPrompt(viewer: VerifyViewer | null | undefined): boolean {
  if (!viewer) return false
  if (typeof viewer.viewerNeedsVerification === 'boolean') return viewer.viewerNeedsVerification
  return viewer.globalRole !== 'PLATFORM_ADMIN'
}

/**
 * What this account cannot do until it is verified. Skipped when the account does not need verification.
 * While the query is still loading, nothing is treated as gated.
 */
export function useGatedActions() {
  const viewer = useQuery(ViewerDocument).data?.viewer ?? null
  const needsPrompt = needsVerifyPrompt(viewer)
  const skip = !viewer || !needsPrompt || viewer.verified
  const gatedQuery = useQuery(UnverifiedGatedActionsDocument, { skip, fetchPolicy: 'cache-and-network' })
  const names = new Set(gatedQuery.data?.unverifiedGatedActions ?? [])
  const gated = (name: string) => !skip && names.has(name)
  return { viewer, needsPrompt, gated, actions: skip ? [] : [...names] }
}

/** The account-screen sentence for whatever the API currently gates. Nothing while that list is empty. */
export function accountGateCopy(actions: readonly string[]): string | null {
  const named = EXPLAINED.filter(([name]) => actions.includes(name)).map(([, phrase]) => phrase)
  if (!named.length) return actions.length ? 'Some features wait until this account is verified. You can keep notes, study and use your classes.' : null
  const last = named[named.length - 1] ?? ''
  const body = named.length === 1 ? last : `${named.slice(0, -1).join(', ')} and ${last}`
  return `You can keep notes, study and use your classes. ${body.charAt(0).toUpperCase()}${body.slice(1)} waits until this account is verified.`
}

/** Sharing-screen sentence. Public is the setting; sharing a note is `note.share`. */
export function shareGateCopy(parts: { publicWaits: boolean; shareWaits: boolean }): string | null {
  const waiting = [parts.publicWaits ? 'making it public' : '', parts.shareWaits ? 'sharing it with someone' : ''].filter((part) => part.length > 0)
  if (!waiting.length) return null
  const list = waiting.length === 2 ? `${waiting[0]} and ${waiting[1]}` : waiting[0]
  return `This account is not verified yet, so ${list} waits. You can keep writing the note.`
}

/** Shown under the account standing when this person still has gated actions. Hidden when they do not need verification. */
export function VerifyAccountNote() {
  const { viewer, needsPrompt, actions } = useGatedActions()
  if (!viewer || !needsPrompt || viewer.verified) return null
  const text = accountGateCopy(actions)
  if (!text) return null
  return <Text className="text-muted-foreground text-sm">{text}</Text>
}
