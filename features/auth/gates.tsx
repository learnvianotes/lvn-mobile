import { useQuery } from '@apollo/client/react'
import { Text } from '@/components/ui/text'
import { UnverifiedGatedActionsDocument, ViewerDocument } from '@/graphql/generated/graphql'

/** Names `unverifiedGatedActions` uses for the gates this app explains (contracts 0.74.0). */
export const GATED = {
  publish: 'PUBLISH_NOTE',
  visibility: 'CHANGE_NOTE_VISIBILITY',
  share: 'SHARE_NOTE',
  submitResource: 'SUBMIT_RESOURCE',
} as const

/**
 * What this account cannot do until it is verified. Platform admins are never gated, and the list is empty once verified.
 * While the query is still loading, nothing is treated as gated.
 */
export function useGatedActions() {
  const viewer = useQuery(ViewerDocument).data?.viewer ?? null
  const admin = viewer?.globalRole === 'PLATFORM_ADMIN'
  const skip = !viewer || admin || viewer.verified
  const gatedQuery = useQuery(UnverifiedGatedActionsDocument, { skip, fetchPolicy: 'cache-and-network' })
  const names = new Set(gatedQuery.data?.unverifiedGatedActions ?? [])
  const gated = (name: string) => !skip && names.has(name)
  return { viewer, admin, gated, actions: skip ? [] : [...names] }
}

/** The account-screen sentence for whatever the API currently gates. Nothing while that list is empty. */
export function accountGateCopy(actions: readonly string[]): string | null {
  const named = [
    actions.includes(GATED.publish) ? 'publishing a note' : '',
    actions.includes(GATED.visibility) || actions.includes(GATED.share) ? 'choosing who can read it' : '',
    actions.includes(GATED.submitResource) ? 'submitting a resource' : '',
  ].filter((part): part is string => part.length > 0)
  if (!named.length) return actions.length ? 'Some features wait until this account is verified. You can keep notes, study and use your classes.' : null
  const last = named[named.length - 1] ?? ''
  const body = named.length === 1 ? last : `${named.slice(0, -1).join(', ')} and ${last}`
  return `You can keep notes, study and use your classes. ${body.charAt(0).toUpperCase()}${body.slice(1)} waits until this account is verified.`
}

/** Shown under the account standing when this person still has gated actions. Never for a platform admin. */
export function VerifyAccountNote() {
  const { viewer, admin, actions } = useGatedActions()
  if (!viewer || admin || viewer.verified) return null
  const text = accountGateCopy(actions)
  if (!text) return null
  return <Text className="text-muted-foreground text-sm">{text}</Text>
}
