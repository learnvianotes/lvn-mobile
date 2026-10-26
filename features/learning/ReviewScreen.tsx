import { useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { RichDoc } from '@/features/notes/render/RichText'
import { Loading, LoadFailed } from '@/features/shell/LoadState'
import { ReviewQueueDocument, type ReviewQueueQuery } from '@/graphql/generated/graphql'
import type { Doc } from '@/lib/contracts/validation'
import { haptic } from '@/lib/haptics'
import { cachedQueue, cacheQueue, grade, sendGrades, waitingCount, type Rating } from '@/lib/reviews'

type Queue = ReviewQueueQuery['reviewQueue']
type Card = Queue['cards'][number]

const RATINGS: { rating: Rating; label: string }[] = [
  { rating: 'AGAIN', label: 'Again' },
  { rating: 'HARD', label: 'Hard' },
  { rating: 'GOOD', label: 'Good' },
  { rating: 'EASY', label: 'Easy' },
]

/**
 * A review session on the phone (lvn-backend ADR-0068): today's cards one by one, the front, then the back and four
 * grades with a haptic tick. Grading moves on at once; grades wait in the phone's store and go in order, so a session
 * works offline from the cards last fetched, and says so. With none kept, it says the cards could not load rather than
 * that there is nothing to review. A card graded Again comes back at the end.
 */
export function ReviewScreen() {
  const insets = useSafeAreaInsets()
  const fg = String(useCSSVariable('--color-foreground') ?? '#152033')
  const { data, error, refetch } = useQuery(ReviewQueueDocument, { fetchPolicy: 'network-only' })
  const [queue, setQueue] = useState<Queue | null>(null)
  const [cards, setCards] = useState<Card[] | null>(null)
  // Where the cards came from when the API could not be reached: the phone's store, or nowhere.
  const [fallback, setFallback] = useState<'stored' | 'none' | null>(null)
  const [index, setIndex] = useState(0)
  const [shown, setShown] = useState(false)
  const [done, setDone] = useState(0)
  const [waiting, setWaiting] = useState(0)
  const started = useRef(Date.now())

  useEffect(() => {
    if (data && !cards) {
      setQueue(data.reviewQueue)
      setCards(data.reviewQueue.cards)
      setFallback(null)
      void cacheQueue(data.reviewQueue)
    }
  }, [data, cards])
  // Offline: the cards last fetched; with none kept, the cards could not load (not "nothing to review").
  useEffect(() => {
    if (!error || cards) return
    void cachedQueue<Queue>().then((q) => {
      if (!q) return setFallback('none')
      setQueue(q)
      setCards(q.cards)
      setFallback('stored')
    })
  }, [error, cards])
  useEffect(() => {
    void sendGrades().then(() => waitingCount().then(setWaiting))
  }, [])

  const card = cards?.[index]
  const answer = async (rating: Rating) => {
    if (!card || !cards) return
    haptic.tick()
    const took = Date.now() - started.current
    if (rating === 'AGAIN') setCards([...cards, card])
    setIndex((i) => i + 1)
    setShown(false)
    setDone((n) => n + 1)
    started.current = Date.now()
    await grade(card.cardId, rating, took)
    setWaiting(await waitingCount())
    // Once the grade has gone (or could not), say what still waits.
    await sendGrades()
    setWaiting(await waitingCount())
  }

  return (
    <View className="bg-background flex-1">
      <View className="flex-row items-center gap-2 px-3 pb-2" style={{ paddingTop: insets.top + 6 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} className="size-10 items-center justify-center rounded-full">
          <ArrowLeft size={22} color={fg} />
        </Pressable>
        <Text className="text-lg font-bold" accessibilityRole="header">
          Review
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 32 }}>
        {fallback === 'stored' ? (
          <Text accessibilityLiveRegion="polite" className="text-muted-foreground text-center text-sm">
            Offline — cards from your last sync
          </Text>
        ) : null}
        {!cards ? fallback === 'none' ? <LoadFailed message="Your cards could not load, and none were kept on this phone yet." onRetry={refetch} /> : <Loading /> : null}
        {cards && !cards.length ? (
          <View className="items-center gap-2 py-10">
            <Text className="text-xl font-bold">Nothing to review</Text>
            <Text className="text-muted-foreground text-center">Add flashcards to your notes, or study the cards of a note you read, and they come back here when it is time.</Text>
          </View>
        ) : null}
        {cards?.length && !card ? (
          <View className="items-center gap-2 py-10">
            <Text className="text-xl font-bold">Done for today</Text>
            <Text className="text-muted-foreground">{done === 1 ? '1 card reviewed.' : `${done} cards reviewed.`}</Text>
            {queue?.waiting ? <Text className="text-muted-foreground">{queue.waiting === 1 ? '1 more card waits for the next days.' : `${queue.waiting} more cards wait for the next days.`}</Text> : null}
          </View>
        ) : null}
        {card ? (
          <>
            <View className="flex-row items-center justify-between">
              <Text className="text-muted-foreground text-sm">
                {Math.min(index + 1, cards!.length)} of {cards!.length}
              </Text>
              <Text className="text-muted-foreground flex-1 text-right text-sm" numberOfLines={1}>
                {card.noteTitle || 'Untitled'}
              </Text>
            </View>
            <View accessibilityLabel="Flashcard" className="bg-card border-border min-h-48 gap-4 rounded-2xl border p-5">
              <RichDoc doc={card.front as Doc} />
              {shown ? (
                <View className="border-border border-t pt-4">
                  <RichDoc doc={card.back as Doc} />
                </View>
              ) : null}
            </View>
            {shown ? (
              <View accessibilityLabel="How well did you know it?" className="flex-row flex-wrap gap-2">
                {RATINGS.map((r) => (
                  <Pressable key={r.rating} accessibilityRole="button" onPress={() => void answer(r.rating)} className={`min-w-[47%] flex-1 items-center rounded-xl py-3 ${r.rating === 'GOOD' ? 'bg-primary' : 'border-border border'}`}>
                    <Text className={r.rating === 'GOOD' ? 'text-primary-foreground font-semibold' : 'font-semibold'}>{r.label}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Pressable accessibilityRole="button" onPress={() => (haptic.tick(), setShown(true))} className="bg-primary items-center rounded-xl py-3">
                <Text className="text-primary-foreground font-semibold">Show the answer</Text>
              </Pressable>
            )}
          </>
        ) : null}
        {waiting ? <Text className="text-muted-foreground text-center text-xs">{waiting === 1 ? '1 grade waits to be sent.' : `${waiting} grades wait to be sent.`}</Text> : null}
      </ScrollView>
    </View>
  )
}
