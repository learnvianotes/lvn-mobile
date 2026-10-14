import { CloudOff } from 'lucide-react-native'
import { useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Alert, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'

/** Enough of a useQuery result to tell its states apart (Apollo keeps `data` when a refetch fails and sets `error`). */
export type QueryState = { data?: unknown; error?: unknown; refetch: () => Promise<unknown> }

/** A spinner while the first answer is on its way. */
export function Loading({ className }: { className?: string }) {
  const primary = useCSSVariable('--color-primary') as string | undefined
  return (
    <View className={cn('items-center py-6', className)}>
      <ActivityIndicator accessibilityLabel="Loading" color={primary} />
    </View>
  )
}

/**
 * What could not load, with Try again (which asks once more). A card for a screen or a section; `inline`, one quiet
 * line for a part of a screen that has more around it.
 */
export function LoadFailed({ onRetry, message = 'This could not load. Check your connection.', inline, className }: { onRetry: () => unknown; message?: string; inline?: boolean; className?: string }) {
  const [trying, setTrying] = useState(false)
  const retry = () => {
    setTrying(true)
    // A refetch that fails again rejects; the error it sets keeps this notice on the screen.
    void Promise.resolve()
      .then(onRetry)
      .catch(() => undefined)
      .finally(() => setTrying(false))
  }
  const button = (
    <Button variant="outline" size="sm" accessibilityRole="button" accessibilityLabel="Try again" accessibilityState={{ disabled: trying, busy: trying }} disabled={trying} onPress={retry} className="min-h-11 self-start px-4">
      <Text>{trying ? 'Trying…' : 'Try again'}</Text>
    </Button>
  )
  if (inline) {
    return (
      <View className={cn('flex-row items-center gap-3', className)}>
        <Text accessibilityLiveRegion="polite" className="text-muted-foreground flex-1 text-sm">
          {message}
        </Text>
        {button}
      </View>
    )
  }
  // The alert is full width: margins go on a view around it.
  return (
    <View className={className}>
      <Alert icon={CloudOff}>
        <AlertTitle accessibilityLiveRegion="polite" className="leading-5">
          {message}
        </AlertTitle>
        <View className="pb-1.5 pl-6 pt-1.5">{button}</View>
      </Alert>
    </View>
  )
}

/** Until a query has data: the spinner, or what failed with Try again (its refetch). Nothing once data arrived. */
export function LoadState({ query, message, inline, className }: { query: QueryState; message?: string; inline?: boolean; className?: string }) {
  if (query.data) return null
  if (query.error) return <LoadFailed onRetry={query.refetch} message={message} inline={inline} className={className} />
  return <Loading className={className} />
}
