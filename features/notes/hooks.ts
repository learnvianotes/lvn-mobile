import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { getSyncStatus, subscribeSyncStatus } from './sync/engine'
import { subscribe } from './store/db'

/** Reads from the phone's notes and reads again after every local write or sync. */
export function useLocal<T>(read: () => Promise<T>, deps: unknown[]): T | undefined {
  const [value, setValue] = useState<T>()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(read, deps)
  useEffect(() => {
    let alive = true
    const refresh = () => void load().then((v) => alive && setValue(v))
    refresh()
    const off = subscribe(refresh)
    return () => {
      alive = false
      off()
    }
  }, [load])
  return value
}

export const useSyncStatus = () => useSyncExternalStore(subscribeSyncStatus, getSyncStatus)
