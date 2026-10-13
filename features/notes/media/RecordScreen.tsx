import { useApolloClient, useMutation } from '@apollo/client/react'
import { requestRecordingPermissionsAsync, RecordingPresets, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder } from 'expo-audio'
import { router } from 'expo-router'
import { Mic, Pause, Play, Square } from 'lucide-react-native'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { Outcome, Pill, ScreenHeader } from '@/features/shell/Form'
import { RunAiTaskDocument } from '@/graphql/generated/graphql'
import * as actions from '../store/actions'
import * as db from '../store/db'
import { syncNow } from '../sync/engine'
import { UploadError, uploadToNote } from './NoteMedia'

/** The longest voice note, as the transcription's limit (lvn-backend ADR-0062) */
export const MAX_RECORDING_SECONDS = 30 * 60
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/**
 * A voice note recorded on the phone (lvn-backend ADR-0062): expo-audio, AAC in M4A. Kept, it becomes an audio card of
 * the note, uploaded like any recording; started from the Create sheet, its transcription is queued too and the AI
 * screen opens on it.
 */
export function RecordScreen({ id, transcribe }: { id: string; transcribe?: boolean }) {
  const client = useApolloClient()
  const insets = useSafeAreaInsets()
  const fg = String(useCSSVariable('--color-foreground') ?? '#111827')
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const [runTask] = useMutation(RunAiTaskDocument)
  const [state, setState] = useState<'idle' | 'recording' | 'recorded' | 'saving'>('idle')
  const [seconds, setSeconds] = useState(0)
  const [uri, setUri] = useState<string | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const player = useAudioPlayer(uri ? { uri } : null)
  const playing = useAudioPlayerStatus(player).playing
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  useEffect(() => () => clearInterval(timer.current), [])

  const stop = async () => {
    clearInterval(timer.current)
    await recorder.stop()
    await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined)
    setUri(recorder.uri)
    setState('recorded')
  }
  const start = async () => {
    setMessage(null)
    if (!(await requestRecordingPermissionsAsync()).granted) return setMessage({ ok: false, text: 'Allow LearnViaNotes to use the microphone in the phone’s settings to record voice notes.' })
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
      await recorder.prepareToRecordAsync()
      recorder.record()
    } catch {
      // Another app holds the microphone, or the phone has none that works.
      await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined)
      return setMessage({ ok: false, text: 'The microphone could not start. Close other apps that use it and try again.' })
    }
    setSeconds(0)
    setState('recording')
    timer.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_RECORDING_SECONDS) void stop()
        return s + 1
      })
    }, 1000)
  }
  const save = async () => {
    if (!uri) return
    setState('saving')
    try {
      // The note must be on the server before a recording uploads to it.
      await syncNow(client)
      if ((await db.getNote(id))?.localOnly) throw new UploadError('Connect to the internet to keep this recording.')
      const fileId = await uploadToNote(client, id, { uri, name: `Voice note ${new Date().toISOString().slice(0, 16).replace('T', ' ')}.m4a`, mimeType: 'audio/mp4' })
      const cards = await db.getCards(id)
      const card = await actions.addCard(id, 'audio', cards.at(-1) ?? null, { fileId })
      await syncNow(client)
      if (!transcribe) return router.back()
      // The transcript waits on the AI screen, to keep or drop (ADR-0062).
      await runTask({ variables: { input: { noteId: id, task: 'TRANSCRIBE', cardIds: [card.id] } } }).catch(() => undefined)
      router.replace(`/notes/ai/${id}`)
    } catch (e) {
      setState('recorded')
      setMessage({ ok: false, text: e instanceof UploadError ? e.message : 'The recording could not be uploaded. Check the connection and try again.' })
    }
  }

  return (
    <View className="bg-background flex-1">
      <ScreenHeader title="Voice note" />
      <View className="flex-1 items-center justify-center gap-6 p-6" style={{ paddingBottom: insets.bottom + 24 }}>
        <Text className="text-muted-foreground text-center text-sm">{transcribe ? 'Speak; when you stop, AI writes down what you said for you to keep.' : 'Speak; it becomes an audio card of this note. Transcribe it from AI tasks.'}</Text>
        <Text accessibilityLiveRegion="polite" accessibilityLabel={`Recording time ${clock(seconds)}`} className="font-mono text-5xl">
          {clock(seconds)}
        </Text>
        {state === 'idle' ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Start recording" onPress={() => void start()} className="size-20 items-center justify-center rounded-full bg-red-500">
            <Mic size={34} color="white" />
          </Pressable>
        ) : null}
        {state === 'recording' ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Stop recording" onPress={() => void stop()} className="border-border size-20 items-center justify-center rounded-full border-2">
            <Square size={30} color={fg} />
          </Pressable>
        ) : null}
        {state === 'recorded' || state === 'saving' ? (
          <View className="items-center gap-4">
            <Pressable accessibilityRole="button" accessibilityLabel={playing ? 'Pause' : 'Listen'} onPress={() => (playing ? player.pause() : (player.seekTo(0), player.play()))} className="border-border flex-row items-center gap-2 rounded-full border px-4 py-2">
              {playing ? <Pause size={18} color={fg} /> : <Play size={18} color={fg} />}
              <Text className="font-semibold">{playing ? 'Pause' : 'Listen'}</Text>
            </Pressable>
            {state === 'saving' ? (
              <ActivityIndicator />
            ) : (
              <View className="flex-row gap-2">
                <Pill label="Record again" onPress={() => (setUri(null), setSeconds(0), setState('idle'))} />
                <Pill label="Keep it" primary onPress={() => void save()} />
              </View>
            )}
          </View>
        ) : null}
        <Outcome message={message} />
      </View>
    </View>
  )
}
