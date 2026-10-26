import { useState } from 'react'
import { View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'

/** Three quiet bars. They do not shimmer: motion stays off unless a screen opts in. */
export function Skeleton({ className }: { className?: string }) {
  return <View className={cn('bg-muted rounded-md', className)} />
}

/** Enough of a useQuery result to tell its states apart (Apollo keeps `data` when a refetch fails and sets `error`). */
export type QueryState = { data?: unknown; error?: unknown; refetch: () => Promise<unknown> }

/** Visible "Loading…" plus three skeleton bars (16, 16 and 96) in a narrow column. Not an empty state. */
export function Loading({ className }: { className?: string }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLiveRegion="polite" accessibilityLabel="Loading…" className={cn('w-full max-w-[448px] gap-3 py-4', className)}>
      <Text className="text-muted-foreground text-sm">Loading…</Text>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-24 w-full" />
    </View>
  )
}

/**
 * What could not load, with Try again (which asks once more). A card for a screen or a section; `inline`, one quiet
 * line for a part of a screen that has more around it.
 */
export function LoadFailed({ onRetry, message = 'This could not be loaded.', inline, className }: { onRetry: () => unknown; message?: string; inline?: boolean; className?: string }) {
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
    <View accessibilityRole="alert" className={cn('border-destructive/40 bg-destructive/10 gap-3 rounded-[14px] border px-4 py-3', className)}>
      <Text accessibilityLiveRegion="polite" className="text-destructive text-sm leading-5">
        {message}
      </Text>
      {button}
    </View>
  )
}

/** Until a query has data: the spinner, or what failed with Try again (its refetch). Nothing once data arrived. */
export function LoadState({ query, message, inline, className }: { query: QueryState; message?: string; inline?: boolean; className?: string }) {
  if (query.data) return null
  if (query.error) return <LoadFailed onRetry={query.refetch} message={message} inline={inline} className={className} />
  return <Loading className={className} />
}
