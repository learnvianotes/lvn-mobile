import { useEffect } from 'react'
import { AppState } from 'react-native'
import type { TimeSpentActivity } from '@/lib/contracts/domain/enums'
import { flush, track } from '@/lib/learning'

/** Time shorter than this is a glance, not reading. */
const MIN_MS = 5_000
/** Long sessions are reported in pieces, so a phone that dies loses at most this much. */
const PIECE_MS = 5 * 60_000

/**
 * Time with something open while the app is in the foreground (lvn-backend ADR-0067): `opened` once (NOTE_OPENED,
 * TOPIC_VIEWED), then TIME_SPENT pieces with their activity. Reading is history only; Rhythm counts only learning
 * activities (ADR-0030).
 */
export function useLearningTime(subject: { entityType: string; entityId: string; topicKeys?: string[] } | null, opened: 'NOTE_OPENED' | 'TOPIC_VIEWED' | null, activity: TimeSpentActivity = 'READING') {
  const entityId = subject?.entityId
  const topics = subject?.topicKeys?.join(',') ?? ''
  useEffect(() => {
    if (!subject) return
    const fields = { entityType: subject.entityType, entityId: subject.entityId, topicKeys: subject.topicKeys?.length ? subject.topicKeys.slice(0, 10) : undefined }
    if (opened) void track(opened, fields)
    let since: number | null = AppState.currentState === 'active' ? Date.now() : null
    let total = 0
    const pause = () => {
      if (since !== null) total += Date.now() - since
      since = null
    }
    const report = () => {
      pause()
      if (total >= MIN_MS) void track('TIME_SPENT', { ...fields, durationMs: total, metadata: { activity } })
      total = 0
    }
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') since ??= Date.now()
      else {
        report()
        void flush()
      }
    })
    const every = setInterval(() => {
      report()
      if (AppState.currentState === 'active') since = Date.now()
    }, PIECE_MS)
    return () => {
      clearInterval(every)
      sub.remove()
      report()
    }
    // The subject is named by its id and topics; a new object for the same note is the same subject.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, topics, opened, activity])
}
