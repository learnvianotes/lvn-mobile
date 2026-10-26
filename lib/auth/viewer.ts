import type { ApolloClient } from '@apollo/client'
import { ViewerDocument, type ViewerQuery } from '@/graphql/generated/graphql'

/**
 * The signed-in account from the network. Verification changes `emailVerified` and `verified` on the server;
 * a cached copy from sign-in stays stale until this runs.
 */
export async function refreshViewer(client: ApolloClient): Promise<ViewerQuery['viewer']> {
  const { data } = await client.query({ query: ViewerDocument, fetchPolicy: 'network-only' })
  return data.viewer
}
