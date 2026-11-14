import { router, usePathname } from 'expo-router'
import { useShareIntentContext } from 'expo-share-intent'
import { useEffect, useRef, useState } from 'react'
import { useSession } from '@/lib/auth/session'
import { prepareShare } from './classify'
import { copyShareFile, deleteShareFile } from './files'
import { fingerprintOf, pendingShares, shareResume, type PendingItem, type PendingShare } from './pending'

function itemKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Copies a system share into the app cache as soon as it arrives (a content URI does not last), remembers it for
 * 24 hours, and opens Save to LVN once the person is signed in.
 */
export function ShareIncoming() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext()
  const phase = useSession((s) => s.status)
  const registered = useSession((s) => s.registrationComplete !== false)
  const path = usePathname()
  const generation = useRef(0)
  const opened = useRef<string | null>(null)

  useEffect(() => {
    const { expired } = pendingShares.read()
    expired?.items.forEach((item) => deleteShareFile(item.uri))
  }, [])

  useEffect(() => {
    if (!hasShareIntent) return
    const fingerprint = fingerprintOf(shareIntent)
    if (pendingShares.read().share?.fingerprint === fingerprint) {
      resetShareIntent(true)
      return
    }
    const ticket = ++generation.current
    const prepared = prepareShare(shareIntent)
    pendingShares.setReceiving(true)
    void (async () => {
      try {
        const items: PendingItem[] = []
        for (const file of prepared.files) {
          let uri = ''
          let message = file.message
          let kind = file.kind
          if (file.path && kind !== 'unsupported') {
            try {
              uri = await copyShareFile(file.path, file.name)
            } catch {
              uri = ''
              kind = 'unsupported'
              message = 'This file could not be kept. Share it again.'
            }
          }
          items.push({ key: itemKey(), uri, name: file.name, mimeType: file.mimeType, size: file.size, kind, message })
        }
        if (ticket !== generation.current) {
          items.forEach((item) => deleteShareFile(item.uri))
          return
        }
        if (!prepared.text && items.length === 0) {
          resetShareIntent(true)
          return
        }
        const previous = pendingShares.read().share
        if (previous && previous.fingerprint !== fingerprint) previous.items.forEach((item) => deleteShareFile(item.uri))
        const share: PendingShare = { id: itemKey(), fingerprint, receivedAt: Date.now(), text: prepared.text, items }
        pendingShares.save(share)
        resetShareIntent(true)
      } finally {
        if (ticket === generation.current) pendingShares.setReceiving(false)
      }
    })()
  }, [hasShareIntent, shareIntent, resetShareIntent])

  const [arrived, setArrived] = useState(0)
  useEffect(() => pendingShares.subscribe(() => setArrived((n) => n + 1)), [])

  useEffect(() => {
    const pending = pendingShares.read().share
    if (!pending) return
    if (shareResume({ phase, registered, hasPending: true }) !== 'open') return
    // Opening once per share lets Back leave the screen. A later share has a new id and opens again.
    if (opened.current === pending.id) return
    opened.current = pending.id
    if (path !== '/share') router.push('/share')
  }, [phase, registered, path, hasShareIntent, arrived])

  return null
}
