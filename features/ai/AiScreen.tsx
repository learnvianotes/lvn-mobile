import type { Reference } from '@apollo/client'
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import {
  BookOpenCheck,
  Brain,
  Check,
  CircleHelp,
  CodeXml,
  Layers,
  Lightbulb,
  ListChecks,
  ListTree,
  Mic,
  Wand2,
  NotebookPen,
  ScrollText,
  SearchCheck,
  Share2,
  SpellCheck,
  Sparkles,
  Trash2,
  type LucideIcon,
} from 'lucide-react-native'
import { useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Share, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { attempt } from '@/features/groups/shared'
import { useLocal } from '@/features/notes/hooks'
import { CardView } from '@/features/notes/render/CardView'
import { Markdown } from '@/features/notes/render/Markdown'
import * as db from '@/features/notes/store/db'
import { syncNow } from '@/features/notes/sync/engine'
import { Outcome, Pill, ScreenHeader } from '@/features/shell/Form'
import {
  AiArtifactDocument,
  AiStateDocument,
  ApplyAiChangesDocument,
  DeleteAiArtifactDocument,
  KeepAiCardsDocument,
  NoteAiArtifactsDocument,
  RunAiTaskDocument,
  type AiArtifactFieldsFragment,
  type AiLanguage,
  type AiTask,
  type AiUnavailableReason,
  type KeepCardsInto,
} from '@/graphql/generated/graphql'
import type { CardType } from '@/lib/contracts/domain/enums'
import { cn } from '@/lib/utils'
import { AnswerList, AskForm } from './AskAi'

/**
 * AI tasks on a note, on the phone (lvn-backend ADR-0059; the web's features/ai/AiPanel): one menu for every task,
 * results beside the note that only their maker sees, and cards kept in one tap — into this note for people who may
 * edit it, otherwise into a new private note, which the phone then pulls. Clean-up (ADR-0063) proposes changes to the
 * note's own words instead, which its editor checks and applies.
 */

type Artifact = AiArtifactFieldsFragment

export const TASK_LABEL: Record<AiTask, string> = {
  SUMMARIZE: 'Summarise',
  KEY_CONCEPTS: 'Key concepts',
  EXPLAIN_SIMPLY: 'Explain simply',
  PRACTICE_QUESTIONS: 'Practice questions',
  TRANSLATE: 'Translate',
  FIND_MISTAKES: 'Find mistakes',
  EXPLAIN_CODE: 'Explain the code',
  FLASHCARDS: 'Flashcards',
  QUIZ: 'Quiz',
  REVISION_SHEET: 'Revision sheet',
  CREATE_NOTES: 'Make notes',
  OUTLINE_TO_NOTE: 'Outline → note',
  TRANSCRIBE: 'Transcribe',
  QUICK_NOTE: 'Tidy into notes',
  CLEAN_UP: 'Clean up the text',
}
const HINT: Record<AiTask, string> = {
  SUMMARIZE: 'The note in a few lines',
  KEY_CONCEPTS: 'The terms that matter',
  EXPLAIN_SIMPLY: 'In plain words',
  PRACTICE_QUESTIONS: 'Test yourself, with answers',
  TRANSLATE: 'Hindi, Telugu or English',
  FIND_MISTAKES: 'Errors, and their fixes',
  EXPLAIN_CODE: 'The code, step by step',
  FLASHCARDS: 'Cards to keep and revise',
  QUIZ: 'Questions to keep',
  REVISION_SHEET: 'The note on one page',
  CREATE_NOTES: 'Fresh notes, as your own',
  OUTLINE_TO_NOTE: 'An outline made full',
  TRANSCRIBE: 'A recording, as text to keep',
  QUICK_NOTE: 'Your rough notes and photos, made clean',
  CLEAN_UP: 'Mends words a PDF’s conversion broke, for you to check',
}
const TASKS: { task: AiTask; icon: LucideIcon }[] = [
  { task: 'SUMMARIZE', icon: ScrollText },
  { task: 'KEY_CONCEPTS', icon: Lightbulb },
  { task: 'EXPLAIN_SIMPLY', icon: Brain },
  { task: 'PRACTICE_QUESTIONS', icon: CircleHelp },
  { task: 'FIND_MISTAKES', icon: SearchCheck },
  { task: 'EXPLAIN_CODE', icon: CodeXml },
  { task: 'FLASHCARDS', icon: Layers },
  { task: 'QUIZ', icon: ListChecks },
  { task: 'REVISION_SHEET', icon: BookOpenCheck },
  { task: 'CREATE_NOTES', icon: NotebookPen },
  { task: 'OUTLINE_TO_NOTE', icon: ListTree },
  { task: 'QUICK_NOTE', icon: Wand2 },
  { task: 'CLEAN_UP', icon: SpellCheck },
]
/** Work on the person's own words: only for people who may edit the note. */
const EDITORS_ONLY = new Set<AiTask>(['QUICK_NOTE', 'CLEAN_UP'])
/** Make something new from the note: they need the right to copy it and are always kept as a new note (ADR-0025). */
const DERIVATIVE = new Set<AiTask>(['CREATE_NOTES', 'OUTLINE_TO_NOTE'])
const LANGUAGE: Record<AiLanguage, string> = { HINDI: 'Hindi', TELUGU: 'Telugu', ENGLISH: 'English' }
const UNAVAILABLE: Record<AiUnavailableReason, string> = {
  NOT_CONFIGURED: 'AI isn’t switched on here yet.',
  BUDGET: 'AI is resting until next month: this month’s AI budget is used up.',
  PROVIDER_DOWN: 'The AI model isn’t answering right now. Try again in a minute.',
}
const POLL_MS = 1500

const plural = (n: number) => `${n} card${n === 1 ? '' : 's'}`
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

export function AiScreen({ id }: { id: string }) {
  const insets = useSafeAreaInsets()
  const primary = String(useCSSVariable('--color-primary') ?? '#1e4d8c')
  const state = useQuery(AiStateDocument, { fetchPolicy: 'cache-and-network' })
  const list = useQuery(NoteAiArtifactsDocument, { variables: { noteId: id }, fetchPolicy: 'cache-and-network' })
  const localCards = useLocal(() => db.getCards(id), [id])
  const [runTask, running] = useMutation(RunAiTaskDocument)
  const [language, setLanguage] = useState<AiLanguage>('HINDI')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const note = list.data?.note
  const status = state.data?.aiStatus
  const allowance = state.data?.myAiAllowance
  const spent = allowance?.limitToday != null && allowance.usedToday >= allowance.limitToday
  const off = status ? !status.available : false
  // A note on the phone says whether it has code; one read online leaves the server to say.
  const hasCode = localCards?.length ? localCards.some((c) => c.type === 'code') : undefined
  const tasks = TASKS.filter(({ task }) => (DERIVATIVE.has(task) ? !!note?.viewerCan.fork : task === 'EXPLAIN_CODE' ? hasCode !== false : EDITORS_ONLY.has(task) ? !!note?.viewerCan.edit : true))
  // Its recordings, each transcribed on its own (ADR-0062).
  const recordings = (note?.cards.edges ?? []).map((e) => e.node).filter((c) => c.type === 'audio' || c.type === 'video')
  const disabled = off || spent || running.loading || !note

  const run = async (task: AiTask, lang: AiLanguage = 'ENGLISH', cardIds?: string[]) => {
    setMessage(null)
    const problem = await attempt(
      () =>
        runTask({
          variables: { input: { noteId: id, task, language: lang, ...(cardIds ? { cardIds } : {}) } },
          update(cache, { data }) {
            const made = data?.runAiTask.artifact
            if (!made) return
            cache.modify({
              id: cache.identify({ __typename: 'Note', id }),
              fields: { aiArtifacts: (existing, { toReference }) => [toReference({ __typename: 'AiArtifact', id: made.id }), ...(Array.isArray(existing) ? existing : [])] },
            })
          },
        }),
      'That didn’t start. Try again.',
    )
    if (problem) {
      setMessage({ ok: false, text: problem })
      void state.refetch().catch(() => undefined)
    }
  }

  return (
    <View className="bg-background flex-1">
      <ScreenHeader title="AI tasks" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 40 }}>
        {list.error && !list.data ? <Text className="text-muted-foreground py-16 text-center">Connect to the internet to use AI on this note.</Text> : null}
        {note ? (
          <Text className="text-muted-foreground text-sm">
            Ask AI about <Text className="text-foreground font-semibold">{note.title || 'Untitled note'}</Text>. Results stay beside it and only you see them; the note itself is never changed.
          </Text>
        ) : null}
        {status && !status.available ? (
          <Text accessibilityRole="alert" className="rounded-2xl border border-warm bg-warm-soft p-3 text-sm">
            {UNAVAILABLE[status.reason ?? 'NOT_CONFIGURED']}
          </Text>
        ) : null}
        {allowance && !off ? <Allowance used={allowance.usedToday} limit={allowance.limitToday} resetsAt={allowance.resetsAt} /> : null}

        {note ? (
          <View className="gap-3">
            <AskForm scope="THIS_NOTE" noteId={id} offNotice={false} />
            <AnswerList noteId={id} />
          </View>
        ) : null}

        <View className="flex-row flex-wrap justify-between gap-y-2" accessibilityLabel="Tasks">
          {tasks.map(({ task, icon: Icon }) => (
            <Pressable
              key={task}
              accessibilityRole="button"
              accessibilityLabel={TASK_LABEL[task]}
              accessibilityHint={HINT[task]}
              accessibilityState={{ disabled }}
              disabled={disabled}
              onPress={() => void run(task)}
              className={cn('bg-card border-border w-[48.5%] gap-1 rounded-2xl border p-3', disabled && 'opacity-50')}
            >
              <View className="flex-row items-center gap-1.5">
                <Icon size={16} color={primary} />
                <Text className="text-sm font-semibold">{TASK_LABEL[task]}</Text>
              </View>
              <Text className="text-muted-foreground text-xs">{HINT[task]}</Text>
            </Pressable>
          ))}
        </View>
        {recordings.map((r, i) => (
          <Pressable
            key={r.id}
            accessibilityRole="button"
            accessibilityLabel={recordings.length === 1 ? 'Transcribe the recording' : `Transcribe recording ${i + 1}`}
            accessibilityHint={HINT.TRANSCRIBE}
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={() => void run('TRANSCRIBE', 'ENGLISH', [r.id])}
            className={cn('bg-card border-border flex-row items-center gap-2 rounded-2xl border p-3', disabled && 'opacity-50')}
          >
            <Mic size={16} color={primary} />
            <View className="flex-1">
              <Text className="text-sm font-semibold">{recordings.length === 1 ? 'Transcribe the recording' : `Transcribe recording ${i + 1}`}</Text>
              <Text className="text-muted-foreground text-xs">{HINT.TRANSCRIBE}</Text>
            </View>
          </Pressable>
        ))}
        <View className="bg-card border-border gap-2 rounded-2xl border p-3">
          <Text className="text-sm font-semibold">Translate into</Text>
          <View className="flex-row flex-wrap items-center gap-2">
            {(Object.keys(LANGUAGE) as AiLanguage[]).map((l) => (
              <Pressable key={l} accessibilityRole="radio" accessibilityState={{ checked: language === l }} accessibilityLabel={LANGUAGE[l]} onPress={() => setLanguage(l)} className={cn('rounded-full border px-3 py-1.5', language === l ? 'border-primary bg-primary/10' : 'border-border')}>
                <Text className={cn('text-sm', language === l && 'text-primary font-semibold')}>{LANGUAGE[l]}</Text>
              </Pressable>
            ))}
            <View className="flex-1" />
            <Pill label="Translate" primary disabled={disabled} onPress={() => void run('TRANSLATE', language)} />
          </View>
        </View>
        <Outcome message={message} />

        <Text accessibilityRole="header" className="text-muted-foreground text-xs font-bold uppercase tracking-wide">
          Your results
        </Text>
        {list.loading && !list.data ? <ActivityIndicator /> : null}
        {note && !note.aiArtifacts.length ? <Text className="text-muted-foreground text-sm">Nothing yet. Pick a task above; results take a few seconds.</Text> : null}
        {(note?.aiArtifacts ?? []).map((a) => (
          <Result key={a.id} noteId={id} artifact={a} canEdit={!!note?.viewerCan.edit} onRetry={() => void run(a.task, a.language)} />
        ))}
      </ScrollView>
    </View>
  )
}

export function Allowance({ used, limit, resetsAt }: { used: number; limit: number | null; resetsAt: string }) {
  if (limit == null) return <Text className="text-muted-foreground text-xs">Your plan has no daily AI limit.</Text>
  const share = limit > 0 ? Math.min(1, used / limit) : 1
  return (
    <View className="gap-1.5">
      <Text className="text-muted-foreground text-xs">
        {share >= 1 ? `You’ve used today’s AI allowance. It comes back at ${timeOf(resetsAt)}.` : `Today’s AI allowance: ${Math.round(share * 100)}% used · resets at ${timeOf(resetsAt)}`}
      </Text>
      <View accessible accessibilityRole="progressbar" accessibilityLabel="Today’s AI allowance" accessibilityValue={{ min: 0, max: limit, now: Math.min(used, limit) }} className="bg-secondary h-1.5 overflow-hidden rounded-full">
        <View className={cn('h-full rounded-full', share >= 1 ? 'bg-destructive' : share >= 0.8 ? 'bg-warm-soft0' : 'bg-primary')} style={{ width: `${share * 100}%` }} />
      </View>
    </View>
  )
}

/** Asks for a result until it is READY or FAILED; the answer updates the list through the cache. */
function Poll({ id }: { id: string }) {
  useQuery(AiArtifactDocument, { variables: { id }, pollInterval: POLL_MS, fetchPolicy: 'network-only' })
  return null
}

function Result({ noteId, artifact: a, canEdit, onRetry }: { noteId: string; artifact: Artifact; canEdit: boolean; onRetry: () => void }) {
  const fg = String(useCSSVariable('--color-foreground') ?? '#152033')
  const primary = String(useCSSVariable('--color-primary') ?? '#1e4d8c')
  const [remove, removing] = useMutation(DeleteAiArtifactDocument)
  const pending = a.status === 'QUEUED' || a.status === 'RUNNING'
  const label = a.task === 'TRANSLATE' ? `Translated into ${LANGUAGE[a.language]}` : TASK_LABEL[a.task]
  const drop = () =>
    void attempt(() =>
      remove({
        variables: { id: a.id },
        update(cache, { data }) {
          if (!data?.deleteAiArtifact.ok) return
          cache.modify({
            id: cache.identify({ __typename: 'Note', id: noteId }),
            fields: { aiArtifacts: (existing, { readField }) => (Array.isArray(existing) ? existing.filter((ref: Reference) => readField('id', ref) !== a.id) : existing) },
          })
          cache.evict({ id: cache.identify({ __typename: 'AiArtifact', id: a.id }) })
        },
      }),
    )
  return (
    <View accessibilityLabel={`${label} result`} className="bg-card border-border gap-3 rounded-2xl border p-4">
      <View className="flex-row items-center gap-2">
        <Sparkles size={16} color={primary} />
        <Text className="flex-1 font-semibold" numberOfLines={1}>
          {label}
        </Text>
        {a.keptAt ? (
          <View className="bg-primary/10 flex-row items-center gap-1 rounded-full px-2 py-0.5">
            <Check size={12} color={primary} />
            <Text className="text-primary text-xs">Kept</Text>
          </View>
        ) : null}
        {a.status === 'READY' && a.markdown ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Share this result" onPress={() => void Share.share({ message: a.markdown ?? '' })} className="rounded-full p-1.5">
            <Share2 size={18} color={fg} />
          </Pressable>
        ) : null}
        {pending ? null : (
          <Pressable accessibilityRole="button" accessibilityLabel="Delete this result" disabled={removing.loading} onPress={drop} className="rounded-full p-1.5">
            <Trash2 size={18} color={fg} />
          </Pressable>
        )}
      </View>
      {pending ? (
        <View accessibilityLiveRegion="polite" className="flex-row items-center gap-2">
          <ActivityIndicator size="small" />
          <Text className="text-muted-foreground text-sm">{a.status === 'QUEUED' ? 'Waiting its turn…' : 'Working on it…'}</Text>
          <Poll id={a.id} />
        </View>
      ) : null}
      {a.status === 'FAILED' ? (
        <View className="gap-2">
          <Text accessibilityRole="alert" className="text-destructive text-sm">
            {a.error ?? 'That didn’t work. Try again.'}
          </Text>
          <View className="flex-row">
            <Pill label="Try again" onPress={onRetry} />
          </View>
        </View>
      ) : null}
      {a.status === 'READY' && (a.truncated || a.fromPublishedVersion) ? (
        <Text className="text-muted-foreground text-xs">{[a.truncated ? 'This note is long, so only its start was read.' : null, a.fromPublishedVersion ? 'Made from the published version.' : null].filter(Boolean).join(' ')}</Text>
      ) : null}
      {a.status === 'READY' && a.markdown != null ? <Markdown source={a.markdown} /> : null}
      {a.status === 'READY' && a.cards ? <KeepCards artifact={a} canEdit={canEdit} /> : null}
      {a.status === 'READY' && a.changes ? <ApplyChanges artifact={a} /> : null}
    </View>
  )
}

function KeepCards({ artifact: a, canEdit }: { artifact: Artifact; canEdit: boolean }) {
  const client = useApolloClient()
  const cards = a.cards ?? []
  const [chosen, setChosen] = useState<ReadonlySet<number>>(() => new Set(cards.map((_, i) => i)))
  const [keep, keeping] = useMutation(KeepAiCardsDocument)
  const [done, setDone] = useState<{ into: KeepCardsInto; noteId: string } | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const intoThisNote = canEdit && !DERIVATIVE.has(a.task)
  if (!cards.length) return <Text className="text-muted-foreground text-sm">Nothing usable came back. Try again.</Text>

  const toggle = (i: number) =>
    setChosen((s) => {
      const next = new Set(s)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  const save = async (into: KeepCardsInto) => {
    setMessage(null)
    setDone(null)
    let noteId: string | null | undefined
    const problem = await attempt(async () => {
      const res = await keep({
        variables: { input: { artifactId: a.id, cardIndexes: [...chosen].sort((x, y) => x - y), into } },
        update(cache, { data }) {
          if (data?.keepAiCards.noteId) cache.modify({ id: cache.identify({ __typename: 'AiArtifact', id: a.id }), fields: { keptAt: () => new Date().toISOString() } })
        },
      })
      noteId = res.data?.keepAiCards.noteId
      return res
    }, 'Those cards weren’t kept. Try again.')
    if (problem || !noteId) return setMessage({ ok: false, text: problem ?? 'Those cards weren’t kept. Try again.' })
    // The phone's copy follows: the cards in this note's draft, or the new note.
    await syncNow(client).catch(() => undefined)
    setDone({ into, noteId })
  }

  return (
    <View className="gap-3">
      <Text className="text-muted-foreground text-xs">{DERIVATIVE.has(a.task) ? 'Untick what you don’t want; the rest becomes a new private note of yours, crediting this one.' : 'Untick what you don’t want, then keep the rest.'}</Text>
      {cards.map((c, i) => {
        const on = chosen.has(i)
        return (
          <View key={i} className={cn('flex-row gap-3 rounded-2xl border p-3', on ? 'border-primary/40' : 'border-border opacity-60')}>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`Keep card ${i + 1}`} onPress={() => toggle(i)} hitSlop={8} className={cn('mt-0.5 size-5 items-center justify-center rounded border', on ? 'bg-primary border-primary' : 'border-border')}>
              {on ? <Check size={14} color="white" /> : null}
            </Pressable>
            <View className="flex-1">
              <CardView type={c.type as CardType} content={c.content} />
            </View>
          </View>
        )
      })}
      <View className="flex-row flex-wrap gap-2">
        {intoThisNote ? <Pill label={`Add ${plural(chosen.size)} to this note`} primary disabled={!chosen.size || keeping.loading} onPress={() => void save('NOTE')} /> : null}
        <Pill label={`Save ${plural(chosen.size)} as my note`} primary={!intoThisNote} disabled={!chosen.size || keeping.loading} onPress={() => void save('NEW_NOTE')} />
      </View>
      {done ? (
        <View className="flex-row flex-wrap items-center gap-2">
          <Text accessibilityLiveRegion="polite" className="text-primary text-sm font-semibold">
            {done.into === 'NOTE' ? 'Added to this note.' : 'Saved as a new private note.'}
          </Text>
          {done.into === 'NEW_NOTE' ? <Pill label="Open it" onPress={() => router.push(`/notes/${done.noteId}`)} /> : null}
        </View>
      ) : null}
      <Outcome message={message} />
    </View>
  )
}

/**
 * Clean-up's changes (ADR-0063): each card's words now and mended, chosen by default, applied through the normal save;
 * the phone then pulls the mended cards. A card edited since keeps its words, and the person is told.
 */
function ApplyChanges({ artifact: a }: { artifact: Artifact }) {
  const client = useApolloClient()
  const primary = String(useCSSVariable('--color-primary') ?? '#1e4d8c')
  const changes = a.changes ?? []
  const open = changes.filter((c) => !c.applied)
  const [chosen, setChosen] = useState<ReadonlySet<string>>(() => new Set(open.map((c) => c.cardId)))
  const [apply, applying] = useMutation(ApplyAiChangesDocument)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  if (!changes.length) return <Text className="text-muted-foreground text-sm">Nothing needs mending.</Text>

  const picked = open.filter((c) => chosen.has(c.cardId)).map((c) => c.cardId)
  const toggle = (id: string) =>
    setChosen((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const save = async () => {
    setMessage(null)
    let applied: string[] = []
    const problem = await attempt(async () => {
      const res = await apply({
        variables: { input: { artifactId: a.id, cardIds: picked } },
        update(cache, { data }) {
          const done = data?.applyAiChanges.applied ?? []
          if (!done.length) return
          cache.modify({
            id: cache.identify({ __typename: 'AiArtifact', id: a.id }),
            fields: {
              changes: (existing) => (Array.isArray(existing) ? existing.map((c: { cardId: string; applied: boolean }) => (done.includes(c.cardId) ? { ...c, applied: true } : c)) : existing),
              keptAt: () => new Date().toISOString(),
            },
          })
        },
      })
      applied = res.data?.applyAiChanges.applied ?? []
      return res
    }, 'The changes weren’t applied. Try again.')
    if (problem) return setMessage({ ok: false, text: problem })
    // What was sent is settled: applied, or refused for a card edited since (sending it again changes nothing).
    setChosen((s) => new Set([...s].filter((id) => !picked.includes(id))))
    // The phone's copy of the note follows.
    if (applied.length) await syncNow(client).catch(() => undefined)
    const refused = picked.length - applied.length
    setMessage({ ok: true, text: [`Applied ${applied.length} change${applied.length === 1 ? '' : 's'}.`, refused ? (refused === 1 ? '1 card was edited since, so it was left as it is.' : `${refused} cards were edited since, so they were left as they are.`) : null].filter(Boolean).join(' ') })
  }

  return (
    <View className="gap-3">
      <Text className="text-muted-foreground text-xs">Only what conversion broke is mended: split words, misread letters, stray page numbers. Check each change; the ones you keep replace the card’s words.</Text>
      {changes.map((c, i) => {
        const on = c.applied || chosen.has(c.cardId)
        return (
          <View key={c.cardId} className={cn('flex-row gap-3 rounded-2xl border p-3', on ? 'border-primary/40' : 'border-border opacity-60')}>
            {c.applied ? (
              <View accessible accessibilityLabel={`Change ${i + 1} applied`} className="mt-0.5 size-5 items-center justify-center">
                <Check size={16} color={primary} />
              </View>
            ) : (
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`Change ${i + 1}`} onPress={() => toggle(c.cardId)} hitSlop={8} className={cn('mt-0.5 size-5 items-center justify-center rounded border', on ? 'bg-primary border-primary' : 'border-border')}>
                {on ? <Check size={14} color="white" /> : null}
              </Pressable>
            )}
            <View className="flex-1 gap-1">
              <Text accessibilityLabel={`Now: ${c.before}`} className="text-muted-foreground text-sm line-through">
                {c.before}
              </Text>
              <Text accessibilityLabel={`Mended: ${c.after}`} className="text-sm">
                {c.after}
              </Text>
            </View>
          </View>
        )
      })}
      {open.length ? <Pill label={!picked.length ? 'Apply changes' : picked.length === 1 ? 'Apply 1 change' : `Apply ${picked.length} changes`} primary disabled={!picked.length || applying.loading} onPress={() => void save()} /> : null}
      <Outcome message={message} />
    </View>
  )
}

/** The account screen's view of AI (P5b): whether it answers, and how much of today's allowance is used. */
export function AiAccountCard({ className }: { className?: string }) {
  const primary = String(useCSSVariable('--color-primary') ?? '#1e4d8c')
  const { data } = useQuery(AiStateDocument, { fetchPolicy: 'cache-and-network' })
  if (!data) return null
  const { aiStatus: status, myAiAllowance: allowance } = data
  return (
    <View className={className} accessibilityLabel="AI">
      <View className="flex-row items-center gap-2" accessible accessibilityRole="header">
        <Sparkles size={18} color={primary} />
        <Text className="text-base font-semibold">AI</Text>
      </View>
      <Text className="text-muted-foreground text-sm">Open a note and tap AI tasks to summarise it, explain it, quiz yourself or make flashcards. Each day your plan gives you an allowance.</Text>
      {status.available ? <Allowance used={allowance.usedToday} limit={allowance.limitToday} resetsAt={allowance.resetsAt} /> : <Text className="text-sm">{UNAVAILABLE[status.reason ?? 'NOT_CONFIGURED']}</Text>}
    </View>
  )
}
