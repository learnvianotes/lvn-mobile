import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { BookOpenCheck } from 'lucide-react-native'
import { useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { attempt } from '@/features/groups/shared'
import { CardView } from '@/features/notes/render/CardView'
import { Markdown } from '@/features/notes/render/Markdown'
import { syncNow } from '@/features/notes/sync/engine'
import { useLive } from '@/features/notifications/live'
import { Outcome, Pill } from '@/features/shell/Form'
import { KeepAiCardsDocument, NoteInsightsDocument, SetAiInsightHiddenDocument } from '@/graphql/generated/graphql'
import type { CardType } from '@/lib/contracts/domain/enums'
import { cn } from '@/lib/utils'
import { TASK_LABEL } from './AiScreen'

/**
 * A public note's study aids on the phone (lvn-backend ADR-0061; the web's features/ai/StudyAids): a summary, key
 * concepts, practice questions, a quiz and flashcards made from its published version. Readers try the quiz and
 * flashcards and keep them as a note of their own; the owner sees each aid being made and hides what they do not want.
 */
const POLL_MS = 3000
const STATUS: Record<string, string> = { QUEUED: 'Waiting its turn', RUNNING: 'Being made', READY: 'Ready', FAILED: 'Could not be made' }

export function StudyAids({ noteId }: { noteId: string }) {
  const client = useApolloClient()
  const primary = String(useCSSVariable('--color-primary') ?? '#1e4d8c')
  const { data, refetch } = useQuery(NoteInsightsDocument, { variables: { id: noteId }, fetchPolicy: 'cache-and-network' })
  const [keepCards, keeping] = useMutation(KeepAiCardsDocument)
  const [setHidden, hiding] = useMutation(SetAiInsightHiddenDocument)
  const [current, setCurrent] = useState(0)
  const [saved, setSaved] = useState<{ aidId: string; noteId: string } | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const note = data?.note
  const status = note?.noteProcessingStatus
  useQuery(NoteInsightsDocument, { variables: { id: noteId }, pollInterval: POLL_MS, skip: !status || status.done, fetchPolicy: 'network-only' })
  useLive((signal) => {
    if ((signal.kind === 'NOTE_PROCESSING' && signal.id === noteId) || signal.kind === 'RECONNECTED') void refetch().catch(() => undefined)
  })
  const aids = note?.aiInsights ?? []
  if (!aids.length) return null
  const owner = !!status
  const aid = aids[Math.min(current, aids.length - 1)]!
  const pending = aid.status === 'QUEUED' || aid.status === 'RUNNING'

  const keep = async () => {
    setMessage(null)
    let made: string | null | undefined
    const problem = await attempt(async () => {
      const res = await keepCards({ variables: { input: { artifactId: aid.id, cardIndexes: (aid.cards ?? []).map((_, i) => i), into: 'NEW_NOTE' } } })
      made = res.data?.keepAiCards.noteId
      return res
    }, 'Those cards weren’t saved. Try again.')
    if (problem || !made) return setMessage({ ok: false, text: problem ?? 'Those cards weren’t saved. Try again.' })
    // The phone pulls the new note, so it opens as the person's own.
    await syncNow(client).catch(() => undefined)
    setSaved({ aidId: aid.id, noteId: made })
  }

  return (
    <View accessibilityLabel="Study aids" className="border-primary/30 bg-card gap-3 rounded-3xl border p-4">
      <View className="flex-row items-center gap-2" accessible accessibilityRole="header">
        <BookOpenCheck size={18} color={primary} />
        <Text className="text-lg font-bold">Study aids</Text>
      </View>
      <Text className="text-muted-foreground text-sm">{owner ? 'Made by AI from your published note for its readers. Hide any you don’t want them to see.' : 'Made by AI from this note: a summary, key concepts, questions to practise with, a quiz and flashcards.'}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} accessibilityRole="tablist">
        {aids.map((a, i) => {
          const selected = a.id === aid.id
          return (
            <Pressable key={a.id} accessibilityRole="tab" accessibilityState={{ selected }} accessibilityLabel={TASK_LABEL[a.task]} onPress={() => setCurrent(i)} className={cn('flex-row items-center gap-1.5 rounded-full border px-3 py-1.5', selected ? 'border-primary bg-primary' : 'border-border', a.hidden && 'opacity-60')}>
              {a.status === 'QUEUED' || a.status === 'RUNNING' ? <ActivityIndicator size="small" /> : null}
              <Text className={cn('text-sm font-medium', selected && 'text-primary-foreground')}>{TASK_LABEL[a.task]}</Text>
            </Pressable>
          )
        })}
      </ScrollView>
      {owner ? (
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-muted-foreground text-xs">{STATUS[aid.status] ?? aid.status}</Text>
          {aid.hidden ? <Text className="bg-secondary rounded-full px-2 py-0.5 text-xs">Hidden from readers</Text> : null}
          <View className="flex-1" />
          {!pending ? <Pill label={aid.hidden ? 'Show to readers' : 'Hide from readers'} disabled={hiding.loading} onPress={() => void attempt(() => setHidden({ variables: { id: aid.id, hidden: !aid.hidden } })).then(() => refetch())} /> : null}
        </View>
      ) : null}
      {pending ? (
        <View accessibilityLiveRegion="polite" className="flex-row items-center gap-2">
          <ActivityIndicator size="small" />
          <Text className="text-muted-foreground text-sm">Being made…</Text>
        </View>
      ) : aid.status === 'FAILED' ? (
        <Text className="text-muted-foreground text-sm">This one could not be made.</Text>
      ) : aid.markdown != null ? (
        <Markdown source={aid.markdown} />
      ) : (
        <View className="gap-3">
          {(aid.cards ?? []).map((c, i) => (
            <View key={i} className="border-border bg-background rounded-2xl border p-3">
              <CardView type={c.type as CardType} content={c.content} />
            </View>
          ))}
        </View>
      )}
      {aid.status === 'READY' && aid.cards?.length ? (
        <View className="flex-row flex-wrap items-center gap-2">
          <Pill label="Save as my note" disabled={keeping.loading} onPress={() => void keep()} />
          {saved?.aidId === aid.id ? (
            <>
              <Text accessibilityLiveRegion="polite" className="text-primary text-sm font-semibold">
                Saved as a new private note.
              </Text>
              <Pill label="Open it" onPress={() => router.push(`/notes/${saved.noteId}`)} />
            </>
          ) : null}
        </View>
      ) : null}
      <Outcome message={message} />
    </View>
  )
}
