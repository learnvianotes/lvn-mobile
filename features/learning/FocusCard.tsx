import { useMutation, useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, Switch, TextInput, View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { useLive } from '@/features/notifications/live'
import {
  AnswerRhythmBuddyDocument,
  EndFocusSessionDocument,
  FocusSessionDocument,
  InviteRhythmBuddyDocument,
  RemoveRhythmBuddyDocument,
  RhythmBuddiesDocument,
  RhythmDocument,
  SetRhythmSharingDocument,
  StartFocusSessionDocument,
  type FocusSessionFieldsFragment,
} from '@/graphql/generated/graphql'
import { haptic } from '@/lib/haptics'
import { openExternal } from '@/lib/open-external'
import { cn } from '@/lib/utils'

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
const field = 'border-border bg-card text-foreground rounded-xl border px-3 py-2.5 text-base'

/** Where a session is now: working, resting, or done, and the seconds left of that part. */
export function phaseOf(s: Pick<FocusSessionFieldsFragment, 'startedAt' | 'plannedMinutes' | 'breakMinutes'>, now: number): { phase: 'FOCUS' | 'BREAK' | 'DONE'; left: number } {
  const gone = Math.max(Math.floor((now - Date.parse(s.startedAt)) / 1000), 0)
  const work = s.plannedMinutes * 60
  if (gone < work) return { phase: 'FOCUS', left: work - gone }
  const rest = s.breakMinutes * 60
  if (gone < work + rest) return { phase: 'BREAK', left: work + rest - gone }
  return { phase: 'DONE', left: 0 }
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }} onPress={onPress} className={cn('rounded-full border px-3 py-1.5', on ? 'border-primary bg-primary' : 'border-border')}>
      <Text className={cn('text-sm', on && 'text-primary-foreground')}>{label}</Text>
    </Pressable>
  )
}

/**
 * Focus mode on the phone (lvn-backend ADR-0072): Pomodoro work and rest, with a Meet link buddies can join. The
 * server counts the time between start and end, at most the plan; the timer here only shows it.
 */
export function FocusCard() {
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#66625b')
  const { data } = useQuery(FocusSessionDocument, { fetchPolicy: 'cache-and-network' })
  const refresh = { refetchQueries: [FocusSessionDocument, RhythmDocument], awaitRefetchQueries: true }
  const [start, starting] = useMutation(StartFocusSessionDocument, refresh)
  const [end, ending] = useMutation(EndFocusSessionDocument, refresh)
  const [minutes, setMinutes] = useState(25)
  const [meetUrl, setMeetUrl] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [counted, setCounted] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const session = data?.focusSession
  useEffect(() => {
    if (!session) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [session])
  const phase = session ? phaseOf(session, now) : null
  return (
    <View className="bg-card border-border gap-3 rounded-2xl border p-4">
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 text-lg font-semibold" accessibilityRole="header">
          Focus
        </Text>
        {/* Board A's dark focus screen: the timer large, pause and resume, Pomodoro and breaks (ADR-0076). */}
        <Pressable accessibilityRole="link" onPress={() => router.push('/focus')}>
          <Text className="text-primary text-sm font-semibold">Open focus mode</Text>
        </Pressable>
      </View>
      {session && phase ? (
        <>
          <Text className="text-4xl font-semibold" accessibilityLabel={`${clock(phase.left)} left`}>
            {clock(phase.left)}
          </Text>
          <Text className="text-muted-foreground text-sm">{phase.phase === 'FOCUS' ? `Focusing: ${session.plannedMinutes} minutes, then a rest.` : phase.phase === 'BREAK' ? 'Rest: stretch, drink some water.' : 'Done. End the session to count it.'}</Text>
          {session.meetUrl ? (
            <Pressable accessibilityRole="link" onPress={() => openExternal(session.meetUrl)}>
              <Text className="text-primary font-semibold">Open the Meet call</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={ending.loading}
            onPress={async () => {
              haptic.success()
              const res = await end({ variables: { input: { id: session.id } } })
              setCounted(res.data?.endFocusSession.session?.focusedSeconds ?? null)
            }}
            className="bg-primary self-start rounded-xl px-4 py-2.5"
          >
            <Text className="text-primary-foreground font-semibold">End the session</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text className="text-muted-foreground text-sm">Work for a set time, then rest. Ten minutes on a topic make the day count for your Rhythm.</Text>
          {counted !== null ? <Text className="text-primary text-sm font-medium">{Math.round(counted / 60) === 1 ? '1 minute counted.' : `${Math.round(counted / 60)} minutes counted.`}</Text> : null}
          <View className="flex-row flex-wrap gap-2">
            {[15, 25, 45, 60].map((m) => (
              <Chip key={m} label={`${m} min`} on={minutes === m} onPress={() => setMinutes(m)} />
            ))}
          </View>
          <TextInput accessibilityLabel="Google Meet link (optional)" placeholder="Meet link (optional)" placeholderTextColor={muted} autoCapitalize="none" autoCorrect={false} value={meetUrl} onChangeText={setMeetUrl} className={field} />
          {problem ? <Text className="text-destructive text-sm">{problem}</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={starting.loading}
            onPress={async () => {
              setProblem(null)
              setCounted(null)
              haptic.tick()
              const res = await start({ variables: { input: { minutes, breakMinutes: 5, meetUrl: meetUrl.trim() || null } } })
              const message = res.data?.startFocusSession.userErrors[0]?.message
              if (message) setProblem(message)
              else router.push('/focus')
            }}
            className="bg-primary self-start rounded-xl px-4 py-2.5"
          >
            <Text className="text-primary-foreground font-semibold">Start focusing</Text>
          </Pressable>
        </>
      )}
    </View>
  )
}

/** Rhythm buddies on the phone (lvn-backend ADR-0072): the list follows the live channel. */
export function BuddiesCard({ shared }: { shared: boolean }) {
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#66625b')
  const { data, refetch } = useQuery(RhythmBuddiesDocument, { fetchPolicy: 'cache-and-network' })
  useLive((signal) => {
    if (signal.kind === 'BUDDY_PRESENCE' || signal.kind === 'RECONNECTED') void refetch().catch(() => undefined)
  })
  const refresh = { refetchQueries: [RhythmBuddiesDocument], awaitRefetchQueries: true }
  const [invite, inviting] = useMutation(InviteRhythmBuddyDocument, refresh)
  const [answer] = useMutation(AnswerRhythmBuddyDocument, refresh)
  const [remove] = useMutation(RemoveRhythmBuddyDocument, refresh)
  const [share] = useMutation(SetRhythmSharingDocument, { refetchQueries: [RhythmDocument] })
  const [handle, setHandle] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const list = data?.rhythmBuddies
  return (
    <View className="bg-card border-border gap-3 rounded-2xl border p-4">
      <Text className="text-lg font-semibold" accessibilityRole="header">
        Rhythm buddies
      </Text>
      <Text className="text-muted-foreground text-sm">Up to five people you follow or are connected with. You see when each other is studying, and each other’s week; nothing else.</Text>
      {list?.invites.map((i) => (
        <View key={i.id} className="bg-secondary gap-2 rounded-xl px-3 py-2">
          <Text className="text-sm">{i.user.displayName} asked you to be Rhythm buddies.</Text>
          <View className="flex-row gap-2">
            <Pressable accessibilityRole="button" onPress={() => void answer({ variables: { input: { id: i.id, accept: true } } })} className="bg-primary rounded-xl px-3 py-1.5">
              <Text className="text-primary-foreground text-sm font-semibold">Accept</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => void answer({ variables: { input: { id: i.id, accept: false } } })} className="rounded-xl px-3 py-1.5">
              <Text className="text-sm font-semibold">Decline</Text>
            </Pressable>
          </View>
        </View>
      ))}
      {list && !list.buddies.length ? <Text className="text-muted-foreground text-sm">No buddies yet.</Text> : null}
      {list?.buddies.map((b) => (
        <View key={b.id} className="bg-muted flex-row items-center justify-between gap-2 rounded-xl px-3 py-2">
          <View className="flex-1">
            <Text className="font-medium">
              {b.user.displayName}
              {b.studyingNow ? ' · Studying now' : ''}
            </Text>
            <Text className="text-muted-foreground text-sm">
              {b.studyingNow && b.topicTitle ? `On ${b.topicTitle} · ` : ''}
              {b.countedDays} of {b.target} days this week
            </Text>
            {/* The pair's week together (lvn-backend ADR-0081). */}
            <Text className="text-muted-foreground text-sm">
              Together: {b.together.countedDays} of {b.together.target} days
            </Text>
          </View>
          {b.studyingNow && b.meetUrl ? (
            <Pressable accessibilityRole="link" onPress={() => openExternal(b.meetUrl)}>
              <Text className="text-primary font-semibold">Join</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel={`Stop being buddies with ${b.user.displayName}`} onPress={() => void remove({ variables: { input: { id: b.id } } })} className="p-1">
            <Text className="text-muted-foreground">×</Text>
          </Pressable>
        </View>
      ))}
      {list?.sent.map((s) => (
        <View key={s.id} className="flex-row items-center justify-between">
          <Text className="text-muted-foreground text-sm">Waiting for {s.user.displayName} to answer.</Text>
          <Pressable accessibilityRole="button" onPress={() => void remove({ variables: { input: { id: s.id } } })}>
            <Text className="text-primary text-sm font-semibold">Take back</Text>
          </Pressable>
        </View>
      ))}
      <View className="flex-row items-center gap-2">
        <TextInput accessibilityLabel="Ask someone by their handle" placeholder="@handle" placeholderTextColor={muted} autoCapitalize="none" autoCorrect={false} value={handle} onChangeText={setHandle} className={cn(field, 'flex-1')} />
        <Pressable
          accessibilityRole="button"
          disabled={inviting.loading || !handle.trim()}
          onPress={async () => {
            setProblem(null)
            const res = await invite({ variables: { input: { handle: handle.trim() } } })
            const message = res.data?.inviteRhythmBuddy.userErrors[0]?.message
            if (message) setProblem(message)
            else setHandle('')
          }}
          className="bg-primary rounded-xl px-4 py-2.5"
        >
          <Text className="text-primary-foreground font-semibold">Ask</Text>
        </Pressable>
      </View>
      {problem ? <Text className="text-destructive text-sm">{problem}</Text> : null}
      <View className="border-border flex-row items-center gap-3 border-t pt-3">
        <View className="flex-1">
          <Text className="text-sm font-medium">Show my name and days on my classes’ Rhythm ring</Text>
          <Text className="text-muted-foreground text-xs">Your classmates and teachers see your first name and how many days counted this week. Off unless you turn it on.</Text>
        </View>
        <Switch accessibilityLabel="Share my Rhythm with my classes" value={shared} onValueChange={(v) => void share({ variables: { input: { share: v } } })} />
      </View>
    </View>
  )
}
