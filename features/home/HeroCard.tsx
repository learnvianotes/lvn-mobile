import { useQuery } from '@apollo/client/react'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { Text } from '@/components/ui/text'
import { DailyLineDocument } from '@/graphql/generated/graphql'

/** While AI writes today's line, how often and how long Home asks again. */
const POLL_MS = 4_000
const POLL_FOR_MS = 60_000

/**
 * Inverse panel on Home: the greeting is the heading, and the day's line sits under it once it has arrived.
 * Flat ink, a 4px brand strip. No stars and no gradient.
 */
export function HeroCard({ firstName }: { firstName: string }) {
  const [polling, setPolling] = useState(true)
  const { data, refetch } = useQuery(DailyLineDocument, { fetchPolicy: 'cache-and-network' })
  const today = data?.dailyLine
  const pending = !!today?.pending && polling
  useEffect(() => {
    if (!pending) return
    const timer = setInterval(() => void refetch().catch(() => undefined), POLL_MS)
    const stop = setTimeout(() => setPolling(false), POLL_FOR_MS)
    return () => {
      clearInterval(timer)
      clearTimeout(stop)
    }
  }, [pending, refetch])
  const greeting = firstName ? `Keep learning, ${firstName}` : 'Keep learning'
  return (
    <View testID="home-hero" className="bg-hero overflow-hidden rounded-3xl">
      <View className="bg-primary h-1" />
      <View className="gap-1.5 px-5 py-5">
        <Text className="text-hero-foreground text-2xl font-bold" accessibilityRole="header">
          {greeting}
        </Text>
        {today ? (
          <>
            <Text className="text-hero-foreground text-xl font-semibold">{today.title}</Text>
            <Text className="text-hero-muted text-sm">{today.line}</Text>
          </>
        ) : (
          <Text className="text-hero-muted text-sm">Loading…</Text>
        )}
      </View>
    </View>
  )
}
