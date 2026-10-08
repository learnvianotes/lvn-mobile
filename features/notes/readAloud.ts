import * as Speech from 'expo-speech'
import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Read aloud on the phone (ADR-0025): the system's text-to-speech through expo-speech, card by card, reporting the
 * card being read. Android has no pause, so it is play and stop; playing again starts from a chosen card.
 */
export function useReadAloud(cards: { id: string; text: string }[]) {
  const [current, setCurrent] = useState<string | null>(null)
  const run = useRef(0)
  const stop = useCallback(() => {
    run.current++
    void Speech.stop()
    setCurrent(null)
  }, [])
  const play = useCallback(
    (fromId?: string) => {
      void Speech.stop()
      const mine = ++run.current
      const list = cards.filter((c) => c.text.trim())
      const start = Math.max(0, fromId ? list.findIndex((c) => c.id === fromId) : 0)
      const queue = list.slice(start)
      if (!queue.length) return
      queue.forEach((card, i) =>
        Speech.speak(card.text, {
          onStart: () => {
            if (mine === run.current) setCurrent(card.id)
          },
          onDone: () => {
            if (mine === run.current && i === queue.length - 1) setCurrent(null)
          },
          onStopped: () => {
            if (mine === run.current) setCurrent(null)
          },
        }),
      )
      setCurrent(queue[0]!.id)
    },
    [cards],
  )
  useEffect(() => () => void Speech.stop(), [])
  return { current, playing: current !== null, play, stop }
}
