import { createClient, type Client } from 'graphql-ws'
import { useEffect, useRef } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { getSession, refreshSession } from '@/lib/auth/session'
import { liveEvent, type LiveEvent } from '@/lib/contracts/notifications'
import { liveUrl } from '@/lib/env'

/** A live event, or RECONNECTED: the socket was closed for a while (the app was in the background), so refetch. */
export type LiveSignal = LiveEvent | { kind: 'RECONNECTED' }
type Listener = (signal: LiveSignal) => void

const listeners = new Set<Listener>()
let client: Client | null = null
let unsubscribe: (() => void) | null = null
let appState: AppStateStatus = AppState.currentState
let appListener: { remove(): void } | null = null
let connectedBefore = false

const emit = (signal: LiveSignal) => listeners.forEach((l) => l(signal))

/** The session keeps its access token fresh (lib/auth/session); after a long sleep it may need a refresh first. */
async function token(): Promise<string | null> {
  if (getSession().accessToken) return getSession().accessToken
  return (await refreshSession()) ? getSession().accessToken : null
}

function open(url: string) {
  if (client) return
  client = createClient({
    url,
    connectionParams: async () => {
      const t = await token()
      return t ? { authorization: `Bearer ${t}` } : {}
    },
    retryAttempts: Infinity,
    shouldRetry: () => true,
    retryWait: (retries) => new Promise((resolve) => setTimeout(resolve, Math.min(30_000, 1000 * 2 ** retries) + Math.random() * 1000)),
    on: {
      connected: () => {
        if (connectedBefore) emit({ kind: 'RECONNECTED' })
        connectedBefore = true
      },
    },
  })
  unsubscribe = client.subscribe(
    { query: 'subscription Live { live { kind id at } }' },
    {
      next: ({ data }) => {
        const parsed = liveEvent.safeParse((data as { live?: unknown } | null | undefined)?.live)
        if (parsed.success) emit(parsed.data)
      },
      error: () => undefined,
      complete: () => undefined,
    },
  )
}

function close() {
  unsubscribe?.()
  unsubscribe = null
  void client?.dispose()
  client = null
}

/**
 * Live updates (lvn-backend ADR-0042, spec §9.2): one socket while the app is in the foreground and something
 * listens. In the background it is closed (push takes over, P3h); coming back opens it again and tells listeners to
 * refetch what they show.
 */
export function subscribeLive(listener: Listener): () => void {
  listeners.add(listener)
  if (listeners.size === 1 && liveUrl) {
    const url = liveUrl
    if (appState === 'active') open(url)
    appListener = AppState.addEventListener('change', (next) => {
      const wasActive = appState === 'active'
      appState = next
      if (next === 'active' && !wasActive) {
        connectedBefore = false
        open(url)
        emit({ kind: 'RECONNECTED' })
      } else if (next !== 'active' && wasActive) close()
    })
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size) return
    appListener?.remove()
    appListener = null
    close()
  }
}

/** Calls `onSignal` for every live signal while mounted; the latest callback is used without resubscribing. */
export function useLive(onSignal: Listener): void {
  const latest = useRef(onSignal)
  useEffect(() => {
    latest.current = onSignal
  })
  useEffect(() => subscribeLive((s) => latest.current(s)), [])
}
