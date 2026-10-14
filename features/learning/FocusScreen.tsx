import { useMutation, useQuery } from '@apollo/client/react'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { X } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle } from 'react-native-svg'
import { Text } from '@/components/ui/text'
import { EndFocusSessionDocument, FocusSessionDocument, RhythmDocument, StartFocusSessionDocument } from '@/graphql/generated/graphql'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'
import { phaseOf } from './FocusCard'
import { coreName } from './recommendationHref'

const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

/** Board A's presets: Pomodoro is focus (counted by the server); the breaks are rest, timed here only. */
const PRESETS = [
  { key: 'POMODORO', label: 'Pomodoro', minutes: 25 },
  { key: 'SHORT', label: 'Short Break', minutes: 5 },
  { key: 'LONG', label: 'Long Break', minutes: 15 },
] as const
type Preset = (typeof PRESETS)[number]['key']

/**
 * Focus mode as board A draws it (lvn-backend ADR-0072, ADR-0076): a dark screen, a large timer, pause and resume,
 * and the Pomodoro, Short Break and Long Break presets. The server still counts only focus time: pausing ends the
 * session (its minutes count), resuming starts another for what was left; breaks are timed on the phone alone.
 */
export function FocusScreen() {
  const insets = useSafeAreaInsets()
  const { data } = useQuery(FocusSessionDocument, { fetchPolicy: 'cache-and-network' })
  const refresh = { refetchQueries: [FocusSessionDocument, RhythmDocument], awaitRefetchQueries: true }
  const [start, starting] = useMutation(StartFocusSessionDocument, refresh)
  const [end, ending] = useMutation(EndFocusSessionDocument, refresh)
  const [preset, setPreset] = useState<Preset>('POMODORO')
  const [paused, setPaused] = useState<number | null>(null)
  const [restEnds, setRestEnds] = useState<number | null>(null)
  const [counted, setCounted] = useState(0)
  const [problem, setProblem] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const session = data?.focusSession ?? null
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const phase = session ? phaseOf(session, now) : null
  const resting = restEnds !== null && restEnds > now
  const chosen = PRESETS.find((p) => p.key === preset)!
  // What the large timer shows, and how much of its part is gone (for the ring).
  const left = phase ? phase.left : resting ? Math.ceil((restEnds! - now) / 1000) : paused ?? chosen.minutes * 60
  const whole = phase ? (phase.phase === 'BREAK' ? session!.breakMinutes : session!.plannedMinutes) * 60 : resting ? chosen.minutes * 60 : paused ?? chosen.minutes * 60
  const share = whole ? Math.min(Math.max(1 - left / whole, 0), 1) : 0
  const status = phase
    ? phase.phase === 'FOCUS'
      ? 'Focusing'
      : phase.phase === 'BREAK'
        ? 'Rest: stretch, drink some water'
        : 'Done. End the session to count it.'
    : resting
      ? chosen.label
      : paused !== null
        ? 'Paused'
        : 'Ready'
  const topic = session?.topicKey ? coreName(session.topicKey.replace(/^topic:/, '')) : null

  const begin = async (minutes: number) => {
    setProblem(null)
    haptic.tick()
    const res = await start({ variables: { input: { minutes: Math.min(Math.max(minutes, 5), 90), breakMinutes: 5 } } })
    const message = res.data?.startFocusSession.userErrors[0]?.message
    if (message) setProblem(message)
    else setPaused(null)
  }
  const stop = async () => {
    if (!session) return 0
    haptic.success()
    const res = await end({ variables: { input: { id: session.id } } })
    const seconds = res.data?.endFocusSession.session?.focusedSeconds ?? 0
    setCounted((c) => c + seconds)
    return seconds
  }
  const choose = async (key: Preset) => {
    setPreset(key)
    setPaused(null)
    if (key === 'POMODORO') return setRestEnds(null)
    // A break: any running focus ends first (its time counts), then the rest is timed here.
    if (session) await stop()
    setRestEnds(Date.now() + PRESETS.find((p) => p.key === key)!.minutes * 60_000)
  }

  return (
    <View className="flex-1">
      <StatusBar style="light" />
      <LinearGradient colors={['#0f0c29', '#1e1b4b', '#312e81']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', inset: 0 }} />
      <View className="flex-1 px-6" style={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }}>
        <View className="flex-row items-center justify-between">
          <Text className="flex-1 text-lg font-bold" style={{ color: '#ffffff' }} accessibilityRole="header">
            Focus mode
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close focus mode" hitSlop={8} onPress={() => (router.canGoBack() ? router.back() : router.replace('/rhythm'))} className="rounded-full p-2">
            <X size={24} color="#ffffff" />
          </Pressable>
        </View>

        <View accessibilityRole="tablist" className="mt-6 flex-row justify-center gap-2">
          {PRESETS.map((p) => {
            const on = p.key === preset
            return (
              <Pressable key={p.key} accessibilityRole="tab" accessibilityState={{ selected: on }} disabled={!!session && p.key === 'POMODORO'} onPress={() => void choose(p.key)} className={cn('rounded-full px-4 py-2', on ? 'bg-white' : 'bg-white/10')}>
                <Text className="text-sm font-semibold" style={{ color: on ? '#1e1b4b' : '#e0e7ff' }}>
                  {p.label}
                </Text>
              </Pressable>
            )
          })}
        </View>

        <View className="flex-1 items-center justify-center gap-4">
          {topic ? (
            <Text className="text-sm" style={{ color: '#c7d2fe' }}>
              On {topic}
            </Text>
          ) : null}
          <View className="items-center justify-center" style={{ width: 260, height: 260 }}>
            <Svg width={260} height={260} viewBox="0 0 260 260" style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
              <Circle cx={130} cy={130} r={118} stroke="rgba(255,255,255,0.12)" strokeWidth={10} fill="none" />
              <Circle cx={130} cy={130} r={118} stroke="#a5b4fc" strokeWidth={10} fill="none" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 118 * share} ${2 * Math.PI * 118}`} />
            </Svg>
            <Text className="text-6xl font-extrabold" style={{ color: '#ffffff', fontVariant: ['tabular-nums'] }} accessibilityLabel={`${clock(left)} left`}>
              {clock(left)}
            </Text>
            <Text className="mt-1 text-sm" style={{ color: '#c7d2fe' }}>
              {status}
            </Text>
          </View>
          {counted ? (
            <Text className="text-sm" style={{ color: '#a5b4fc' }}>
              {Math.round(counted / 60) === 1 ? '1 minute counted.' : `${Math.round(counted / 60)} minutes counted.`}
            </Text>
          ) : null}
          {problem ? (
            <Text accessibilityRole="alert" className="text-sm" style={{ color: '#fecaca' }}>
              {problem}
            </Text>
          ) : null}
        </View>

        <View className="flex-row justify-center gap-3">
          {session && phase?.phase === 'FOCUS' ? (
            <Big
              label="Pause"
              disabled={ending.loading}
              onPress={async () => {
                // From this moment, not the last tick of the clock.
                const remaining = phaseOf(session, Date.now()).left
                await stop()
                setPaused(remaining)
              }}
            />
          ) : null}
          {session ? <Big label="End" ghost disabled={ending.loading} onPress={() => void stop().then(() => setPaused(null))} /> : null}
          {!session && paused !== null ? <Big label="Resume" disabled={starting.loading} onPress={() => void begin(Math.ceil(paused / 60))} /> : null}
          {!session && paused !== null ? <Big label="End" ghost onPress={() => setPaused(null)} /> : null}
          {!session && paused === null && resting ? <Big label="Skip break" ghost onPress={() => setRestEnds(null)} /> : null}
          {!session && paused === null && !resting ? (
            <Big
              label="Start"
              disabled={starting.loading}
              onPress={() => {
                setPreset('POMODORO')
                setRestEnds(null)
                void begin(25)
              }}
            />
          ) : null}
        </View>
      </View>
    </View>
  )
}

function Big({ label, onPress, ghost, disabled }: { label: string; onPress: () => void; ghost?: boolean; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} className={cn('min-w-32 items-center rounded-full px-6 py-3.5', ghost ? 'border border-white/40' : 'bg-white')}>
      <Text className="text-base font-bold" style={{ color: ghost ? '#ffffff' : '#1e1b4b' }}>
        {label}
      </Text>
    </Pressable>
  )
}
