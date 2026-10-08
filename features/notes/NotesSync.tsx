import { useApolloClient } from '@apollo/client/react'
import { addNetworkStateListener } from 'expo-network'
import { useEffect } from 'react'
import { AppState } from 'react-native'
import { syncNow } from './sync/engine'

/**
 * Keeps the phone's notes in step with the server (lvn-backend §13.2): when the signed-in screens open, when the app
 * comes back to the foreground, and when the connection returns. Edits ask for a sync themselves (syncSoon).
 */
export function NotesSync() {
  const client = useApolloClient()
  useEffect(() => {
    void syncNow(client)
    const app = AppState.addEventListener('change', (state) => state === 'active' && void syncNow(client))
    const net = addNetworkStateListener((s) => s.isInternetReachable && void syncNow(client))
    return () => {
      app.remove()
      net.remove()
    }
  }, [client])
  return null
}
