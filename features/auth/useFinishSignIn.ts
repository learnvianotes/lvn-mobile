import { useApolloClient } from '@apollo/client/react'
import { useCallback } from 'react'
import { ViewerDocument, type SessionFieldsFragment } from '@/graphql/generated/graphql'
import { signedIn } from '@/lib/auth/session'

/**
 * Forgets any cached data of a previous account, primes the cache with the new viewer and stores the session. The
 * navigator then moves on by itself: app/_layout.tsx shows the screens this session may see.
 */
export function useFinishSignIn() {
  const client = useApolloClient()
  return useCallback(
    async (session: SessionFieldsFragment, then?: string) => {
      await client.clearStore()
      client.writeQuery({ query: ViewerDocument, data: { viewer: session.user } })
      await signedIn(session, then)
    },
    [client],
  )
}
