import { useMutation, useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { ArrowLeft, Check } from 'lucide-react-native'
import { useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { TodayRing } from '@/features/home/TodayRing'
import { EndRhythmPauseDocument, PauseRhythmDocument, RhythmDocument, SetRhythmPlanDocument, type RhythmPauseReason, type RhythmQuery } from '@/graphql/generated/graphql'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'

type R = RhythmQuery['rhythm']

const WEEKDAYS = [
  { day: 1, short: 'M', name: 'Monday' },
  { day: 2, short: 'T', name: 'Tuesday' },
  { day: 3, short: 'W', name: 'Wednesday' },
  { day: 4, short: 'T', name: 'Thursday' },
  { day: 5, short: 'F', name: 'Friday' },
  { day: 6, short: 'S', name: 'Saturday' },
  { day: 7, short: 'S', name: 'Sunday' },
]
const REASONS: { reason: RhythmPauseReason; label: string }[] = [
  { reason: 'EXAMS', label: 'Exams' },
  { reason: 'ILLNESS', label: 'Illness' },
  { reason: 'FESTIVAL', label: 'Festival' },
  { reason: 'TRAVEL', label: 'Travel' },
  { reason: 'OTHER', label: 'Something else' },
]
const STATUS: Record<R['week'][number]['status'], string> = { COUNTED: 'counted', MISSED: 'planned, not counted', REST: 'rest day', PAUSED: 'paused', TODAY: 'today', AHEAD: 'to come' }
/** The bar a day counts at (lvn-backend ADR-0030): 10 learning minutes or 10 reviews. */
const BAR_SECONDS = 600
const BAR_REVIEWS = 10
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
const short = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const refresh = { refetchQueries: [RhythmDocument], awaitRefetchQueries: true }

/** How far today is towards counting, 0–100: learning minutes or reviews, whichever is further along. */
export function ringPercent(today: Pick<R['today'], 'learningSeconds' | 'reviews' | 'counted'>): number {
  if (today.counted) return 100
  return Math.round(Math.min(Math.max(today.learningSeconds / BAR_SECONDS, today.reviews / BAR_REVIEWS), 1) * 100)
}

/**
 * Rhythm on the phone (lvn-backend ADR-0030, ADR-0069): the same as the web. Today's ring and what is left for today
 * to count, a comeback after a missed planned day, this week from Monday to Sunday, the counters that never reset,
 * the planned days and pauses. Never red, never "lost".
 */
export function RhythmScreen() {
  const insets = useSafeAreaInsets()
  const fg = String(useCSSVariable('--color-foreground') ?? '#111827')
  const { data, loading, error } = useQuery(RhythmDocument, { fetchPolicy: 'cache-and-network' })
  const r = data?.rhythm
  return (
    <View className="bg-background flex-1">
      <View className="flex-row items-center gap-2 px-3 pb-2" style={{ paddingTop: insets.top + 6 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} className="rounded-full p-2">
          <ArrowLeft size={22} color={fg} />
        </Pressable>
        <Text className="text-lg font-bold" accessibilityRole="header">
          Rhythm
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 32 }}>
        <Text className="text-muted-foreground text-sm">A weekly habit, not a streak: learn on your planned days, and rest on the others. A day counts at 10 learning minutes or 10 reviews.</Text>
        {!r && loading ? <ActivityIndicator /> : null}
        {!r && error ? <Text className="text-muted-foreground">Your Rhythm could not load. Try again.</Text> : null}
        {r ? (
          <>
            <Today r={r} />
            <Week r={r} />
            <Counters r={r} />
            <Plan r={r} />
            <Pauses r={r} />
            <Text className="text-muted-foreground text-xs">Days are counted in {r.timeZone} and start at 4 in the morning.</Text>
          </>
        ) : null}
      </ScrollView>
    </View>
  )
}

function Card({ title, badge, children }: { title: string; badge?: string | null; children: React.ReactNode }) {
  return (
    <View className="bg-card border-border gap-3 rounded-2xl border p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-bold" accessibilityRole="header">
          {title}
        </Text>
        {badge ? <Text className="bg-secondary text-primary rounded-full px-3 py-1 text-xs font-semibold">{badge}</Text> : null}
      </View>
      {children}
    </View>
  )
}

function Today({ r }: { r: R }) {
  const t = r.today
  const percent = ringPercent(t)
  const minutesLeft = Math.max(Math.ceil((BAR_SECONDS - t.learningSeconds) / 60), 0)
  const reviewsLeft = Math.max(BAR_REVIEWS - t.reviews, 0)
  return (
    <Card title="Today" badge={t.counted ? 'Today counts' : null}>
      <View className="flex-row items-center gap-4">
        <TodayRing done={percent} dayBar={100} full={100} label={`Today’s ring: ${percent}% of the way to a counted day`} centre={{ value: `${percent}%`, caption: 'today' }} />
        <View className="flex-1 gap-2">
          {t.cameBack ? <Text className="text-primary font-semibold">Back on rhythm.</Text> : null}
          {t.comeback ? <Text className="text-primary font-semibold">Comeback day: the same 10 minutes put you back on rhythm.</Text> : null}
          {!t.counted ? (
            <Text className="text-muted-foreground text-sm">
              {minutesLeft} more learning {minutesLeft === 1 ? 'minute' : 'minutes'}, or {reviewsLeft} more {reviewsLeft === 1 ? 'review' : 'reviews'}, and today counts.
            </Text>
          ) : null}
          {t.items.map((item) =>
            item.kind === 'REVIEWS' ? (
              <View key={item.kind} className="flex-row flex-wrap items-center gap-2">
                <Text className="text-sm">
                  Reviews: {item.done} of {item.total}
                </Text>
                {item.done < item.total ? (
                  <Pressable accessibilityRole="link" onPress={() => router.push('/review')}>
                    <Text className="text-primary text-sm font-semibold">Review now</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null,
          )}
        </View>
      </View>
    </Card>
  )
}

function Week({ r }: { r: R }) {
  const primaryFg = String(useCSSVariable('--color-primary-foreground') ?? '#ffffff')
  return (
    <Card title="This week" badge={r.met ? 'Week met' : null}>
      <View className="flex-row justify-between">
        {r.week.map((d) => {
          const w = WEEKDAYS[d.weekday - 1]!
          const status = d.status === 'AHEAD' && !d.planned ? STATUS.REST : STATUS[d.status]
          const label = `${w.name}: ${d.planned && d.status !== 'MISSED' ? `${status}, planned` : status}`
          return (
            <View key={d.day} accessible accessibilityLabel={label} className="items-center gap-1.5">
              <Text className={cn('text-xs', d.day === r.today.day ? 'text-primary font-bold' : 'text-muted-foreground')}>{w.short}</Text>
              <View
                className={cn(
                  'size-9 items-center justify-center rounded-full',
                  d.counted && 'bg-primary',
                  !d.counted && d.planned && d.status !== 'PAUSED' && 'border-primary/60 border-2',
                  !d.counted && d.status === 'MISSED' && 'border-dashed',
                  !d.counted && (!d.planned || d.status === 'PAUSED') && 'bg-muted',
                )}
              >
                {d.counted ? <Check size={14} color={primaryFg} /> : d.status === 'PAUSED' ? <Text className="text-muted-foreground text-xs">‖</Text> : null}
              </View>
            </View>
          )
        })}
      </View>
      <Text className="text-muted-foreground text-sm">
        {r.countedDays} of {r.target} days this week
      </Text>
    </Card>
  )
}

function Counters({ r }: { r: R }) {
  const items = [
    ['Rhythm weeks this term', r.weeksThisTerm],
    ['Rhythm weeks all time', r.weeksAllTime],
    ['Days counted all time', r.countedDaysAllTime],
  ] as const
  return (
    <View className="flex-row gap-2">
      {items.map(([label, n]) => (
        <View key={label} accessible accessibilityLabel={`${label}: ${n}`} className="bg-card border-border flex-1 gap-1 rounded-2xl border p-3">
          <Text className="text-2xl font-extrabold">{n}</Text>
          <Text className="text-muted-foreground text-xs">{label}</Text>
        </View>
      ))}
    </View>
  )
}

function Plan({ r }: { r: R }) {
  const [days, setDays] = useState<number[]>(r.plannedDays)
  const [problem, setProblem] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [save, saving] = useMutation(SetRhythmPlanDocument, refresh)
  const changed = days.join() !== r.plannedDays.join()
  const valid = days.length >= 3 && days.length <= 6
  return (
    <Card title="Your planned days">
      <Text className="text-muted-foreground text-sm">Pick 3 to 6 days. A change applies from this week on.</Text>
      <View className="flex-row flex-wrap gap-2">
        {WEEKDAYS.map((w) => {
          const on = days.includes(w.day)
          return (
            <Pressable
              key={w.day}
              accessibilityRole="button"
              accessibilityLabel={w.name}
              accessibilityState={{ selected: on }}
              onPress={() => {
                haptic.tick()
                setSaved(false)
                setDays((prev) => (on ? prev.filter((x) => x !== w.day) : [...prev, w.day].sort((a, b) => a - b)))
              }}
              className={cn('rounded-full border px-4 py-2', on ? 'border-primary bg-primary' : 'border-border')}
            >
              <Text className={cn('text-sm font-medium', on && 'text-primary-foreground')}>{w.name.slice(0, 3)}</Text>
            </Pressable>
          )
        })}
      </View>
      <View className="flex-row flex-wrap items-center gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !changed || !valid || saving.loading }}
          disabled={!changed || !valid || saving.loading}
          onPress={async () => {
            setProblem(null)
            const res = await save({ variables: { input: { plannedDays: days } } })
            const message = res.data?.setRhythmPlan.userErrors[0]?.message
            if (message) setProblem(message)
            else (setSaved(true), haptic.success())
          }}
          className={cn('bg-primary rounded-xl px-4 py-2.5', (!changed || !valid) && 'opacity-50')}
        >
          <Text className="text-primary-foreground font-semibold">Save days</Text>
        </Pressable>
        {saved && !changed ? <Text className="text-muted-foreground text-sm">Saved. This week now aims for {r.target} days.</Text> : null}
      </View>
      {problem ? <Text className="text-destructive text-sm">{problem}</Text> : null}
    </Card>
  )
}

function Pauses({ r }: { r: R }) {
  const [open, setOpen] = useState(false)
  const [start, setStart] = useState<0 | 1>(0)
  const [length, setLength] = useState(3)
  const [reason, setReason] = useState<RhythmPauseReason>('EXAMS')
  const [problem, setProblem] = useState<string | null>(null)
  const [pause, pausing] = useMutation(PauseRhythmDocument, refresh)
  const [end, ending] = useMutation(EndRhythmPauseDocument, refresh)
  const from = addDays(r.today.day, start)
  const to = addDays(from, length - 1)
  return (
    <Card title="Pauses">
      <Text className="text-muted-foreground text-sm">
        Exams, illness, a festival or travel: pause Rhythm, and paused days are neither missed nor needed. {r.pauseDaysLeft} of 14 pause days left this term.
      </Text>
      {r.pauses.length ? (
        r.pauses.map((p) => (
          <View key={p.id} className="bg-muted flex-row flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2">
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="text-sm">
                {REASONS.find((x) => x.reason === p.reason)?.label}: {short(p.from)} to {short(p.to)}
              </Text>
              {p.active ? <Text className="bg-secondary text-primary rounded-full px-2 py-0.5 text-xs font-medium">Paused now</Text> : null}
            </View>
            <Pressable accessibilityRole="button" disabled={ending.loading} onPress={() => void end({ variables: { input: { id: p.id } } })} className="px-2 py-1">
              <Text className="text-primary text-sm font-semibold">{p.active && p.from < r.today.day ? 'End the pause' : 'Cancel the pause'}</Text>
            </Pressable>
          </View>
        ))
      ) : (
        <Text className="text-muted-foreground text-sm">No pauses.</Text>
      )}
      {open ? (
        <View className="gap-3">
          <View className="flex-row gap-2">
            {(['Today', 'Tomorrow'] as const).map((label, i) => (
              <Chip key={label} label={`From ${label.toLowerCase()}`} on={start === i} onPress={() => setStart(i as 0 | 1)} />
            ))}
          </View>
          <View className="flex-row items-center gap-3">
            <Pressable accessibilityRole="button" accessibilityLabel="One day fewer" disabled={length <= 1} onPress={() => setLength((n) => Math.max(n - 1, 1))} className="border-border size-10 items-center justify-center rounded-full border">
              <Text className="text-lg font-bold">−</Text>
            </Pressable>
            <Text className="text-sm font-semibold" accessibilityLiveRegion="polite">
              {length} {length === 1 ? 'day' : 'days'}: {short(from)} to {short(to)}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="One day more" disabled={length >= 14} onPress={() => setLength((n) => Math.min(n + 1, 14))} className="border-border size-10 items-center justify-center rounded-full border">
              <Text className="text-lg font-bold">+</Text>
            </Pressable>
          </View>
          <View className="flex-row flex-wrap gap-2">
            {REASONS.map((x) => (
              <Chip key={x.reason} label={x.label} on={reason === x.reason} onPress={() => setReason(x.reason)} />
            ))}
          </View>
          {problem ? <Text className="text-destructive text-sm">{problem}</Text> : null}
          <View className="flex-row gap-2">
            <Pressable
              accessibilityRole="button"
              disabled={pausing.loading}
              onPress={async () => {
                setProblem(null)
                const res = await pause({ variables: { input: { from, to, reason } } })
                const message = res.data?.pauseRhythm.userErrors[0]?.message
                if (message) setProblem(message)
                else setOpen(false)
              }}
              className="bg-primary rounded-xl px-4 py-2.5"
            >
              <Text className="text-primary-foreground font-semibold">Pause</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setOpen(false)} className="rounded-xl px-4 py-2.5">
              <Text className="font-semibold">Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable accessibilityRole="button" disabled={r.pauseDaysLeft === 0} onPress={() => setOpen(true)} className={cn('border-border self-start rounded-xl border px-4 py-2.5', r.pauseDaysLeft === 0 && 'opacity-50')}>
          <Text className="font-semibold">Pause Rhythm</Text>
        </Pressable>
      )}
    </Card>
  )
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }} onPress={onPress} className={cn('rounded-full border px-3 py-1.5', on ? 'border-primary bg-primary' : 'border-border')}>
      <Text className={cn('text-sm', on && 'text-primary-foreground')}>{label}</Text>
    </Pressable>
  )
}
