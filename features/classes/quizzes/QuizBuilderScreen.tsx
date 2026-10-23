import { useApolloClient, useMutation } from '@apollo/client/react'
import { router } from 'expo-router'
import { Check, Trash2 } from 'lucide-react-native'
import { useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { attempt, docToText, textToDoc } from '@/features/groups/shared'
import { useLocal } from '@/features/notes/hooks'
import * as db from '@/features/notes/store/db'
import { Field, Pill, ScreenHeader } from '@/features/shell/Form'
import { AiArtifactDocument, PublishClassQuizDocument, RunAiTaskDocument } from '@/graphql/generated/graphql'
import { inlineText, type Doc, type Inline } from '@/lib/contracts/validation'
import { cn } from '@/lib/utils'

/**
 * A quiz for a class on the phone (lvn-backend ADR-0064), composed here and published in one go: questions made by AI
 * from one of the teacher's notes (the QUIZ task) and questions written by hand, each editable before it is published.
 */

interface DraftChoice {
  id: string
  text: string
  correct: boolean
}
interface Draft {
  key: string
  question: string
  choices: DraftChoice[]
  explanation: string
}

const MAX_CHOICES = 8
const MAX_QUESTIONS = 50
const POLL_MS = 1500
let keys = 0
const key = () => `q${++keys}`
const blank = (): Draft => ({ key: key(), question: '', choices: [{ id: 'c1', text: '', correct: true }, { id: 'c2', text: '', correct: false }], explanation: '' })
const nextChoiceId = (choices: DraftChoice[]) => {
  let n = choices.length + 1
  while (choices.some((c) => c.id === `c${n}`)) n++
  return `c${n}`
}
const fromCard = (c: { question: Doc; choices: { id: string; content: Inline }[]; correct: string[]; explanation?: Doc }): Draft => ({
  key: key(),
  question: docToText(c.question),
  choices: c.choices.map((x) => ({ id: x.id, text: inlineText(x.content), correct: c.correct.includes(x.id) })),
  explanation: c.explanation ? docToText(c.explanation) : '',
})

/** A draft as quiz card content, or why it is not ready. */
function toCard(d: Draft, n: number): { content: object } | { problem: string } {
  const choices = d.choices.filter((c) => c.text.trim())
  if (!d.question.trim()) return { problem: `Question ${n} has no words.` }
  if (choices.length < 2) return { problem: `Question ${n} needs at least two choices.` }
  const correct = choices.filter((c) => c.correct).map((c) => c.id)
  if (!correct.length) return { problem: `Tick the correct choice of question ${n}.` }
  return {
    content: {
      question: textToDoc(d.question),
      choices: choices.map((c) => ({ id: c.id, content: [{ type: 'text', text: c.text.trim() }] })),
      correct,
      multiple: correct.length > 1,
      ...(d.explanation.trim() ? { explanation: textToDoc(d.explanation) } : {}),
    },
  }
}

export function QuizBuilderScreen({ classroomId }: { classroomId: string }) {
  const insets = useSafeAreaInsets()
  const fg = String(useCSSVariable('--color-foreground') ?? '#152033')
  const client = useApolloClient()
  const [runTask] = useMutation(RunAiTaskDocument)
  const [publish, publishing] = useMutation(PublishClassQuizDocument)
  const [title, setTitle] = useState('')
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [picking, setPicking] = useState(false)
  const [making, setMaking] = useState<string | null>(null)
  const [sourceNoteId, setSourceNoteId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Notes on the server: the AI reads them there (ADR-0059).
  const notes = (useLocal(() => db.listNotes(false), [picking]) ?? []).filter((n) => !n.localOnly)
  const update = (k: string, change: (d: Draft) => Draft) => setDrafts((all) => all.map((d) => (d.key === k ? change(d) : d)))

  const make = async (noteId: string, noteTitle: string) => {
    setError(null)
    setPicking(false)
    setMaking(noteTitle || 'Untitled note')
    try {
      const res = await runTask({ variables: { input: { noteId, task: 'QUIZ' } } })
      const started = res.data?.runAiTask.artifact
      if (!started) return setError(res.data?.runAiTask.userErrors[0]?.message ?? 'AI could not make questions from that note. Try again, or write them yourself.')
      for (;;) {
        await new Promise((r) => setTimeout(r, POLL_MS))
        const { data } = await client.query({ query: AiArtifactDocument, variables: { id: started.id }, fetchPolicy: 'network-only' })
        const a = data?.aiArtifact
        if (!a || a.status === 'FAILED') return setError(a?.error ?? 'AI could not make questions from that note. Try again, or write them yourself.')
        if (a.status !== 'READY') continue
        const made = (a.cards ?? []).filter((c) => c.type === 'quiz').map((c) => fromCard(c.content as Parameters<typeof fromCard>[0]))
        if (!made.length) return setError('AI could not make questions from that note. Try again, or write them yourself.')
        setDrafts((all) => [...all, ...made].slice(0, MAX_QUESTIONS))
        setSourceNoteId(noteId)
        setTitle((t) => t || noteTitle)
        return
      }
    } catch {
      setError('AI could not make questions from that note. Try again, or write them yourself.')
    } finally {
      setMaking(null)
    }
  }

  const submit = async () => {
    setError(null)
    if (!title.trim()) return setError('Give the quiz a title.')
    if (!drafts.length) return setError('Add at least one question.')
    const cards = drafts.map((d, i) => toCard(d, i + 1))
    const bad = cards.find((c) => 'problem' in c) as { problem: string } | undefined
    if (bad) return setError(bad.problem)
    const problem = await attempt(() => publish({ variables: { input: { classroomId, title: title.trim(), questions: cards.map((c) => (c as { content: object }).content), ...(sourceNoteId ? { sourceNoteId } : {}) } } }), 'The quiz could not be published. Try again.')
    if (problem) return setError(problem)
    router.back()
  }

  return (
    <View className="bg-background flex-1">
      <ScreenHeader title="New quiz" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
        <Field label="Title" value={title} onChangeText={setTitle} maxLength={120} />
        <View className="bg-secondary gap-2 rounded-2xl p-4">
          <Text className="font-semibold">Make questions from a note</Text>
          <Text className="text-muted-foreground text-xs">AI writes questions from the note; check each one, change or remove it, and add your own.</Text>
          {making ? (
            <View className="flex-row items-center gap-2" accessibilityLiveRegion="polite">
              <ActivityIndicator size="small" />
              <Text className="text-sm">Making questions from {making}…</Text>
            </View>
          ) : (
            <Pill label={picking ? 'Close' : 'Choose a note'} onPress={() => setPicking(!picking)} />
          )}
          {picking
            ? notes.slice(0, 30).map((n) => (
                <Pressable key={n.id} accessibilityRole="button" accessibilityLabel={`Make questions from ${n.title || 'Untitled note'}`} onPress={() => void make(n.id, n.title)} className="bg-card border-border rounded-xl border px-3 py-2.5">
                  <Text>{n.title || 'Untitled note'}</Text>
                </Pressable>
              ))
            : null}
        </View>

        {drafts.map((d, i) => (
          <View key={d.key} accessibilityLabel={`Question ${i + 1}`} className="bg-card border-border gap-3 rounded-2xl border p-4">
            <View className="flex-row items-center">
              <Text className="flex-1 font-bold">Question {i + 1}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove question ${i + 1}`} onPress={() => setDrafts((all) => all.filter((x) => x.key !== d.key))} hitSlop={8} className="p-1">
                <Trash2 size={18} color={fg} />
              </Pressable>
            </View>
            <TextInput accessibilityLabel={`Words of question ${i + 1}`} value={d.question} multiline onChangeText={(v) => update(d.key, (x) => ({ ...x, question: v }))} className="border-border text-foreground rounded-xl border p-3" />
            <Text className="text-muted-foreground text-xs font-semibold">Choices — tap the tick for the correct ones</Text>
            {d.choices.map((c, j) => (
              <View key={c.id} className="flex-row items-center gap-2">
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: c.correct }}
                  accessibilityLabel={`Choice ${j + 1} is correct`}
                  onPress={() => update(d.key, (x) => ({ ...x, choices: x.choices.map((y) => (y.id === c.id ? { ...y, correct: !y.correct } : y)) }))}
                  hitSlop={8}
                  className={cn('size-6 items-center justify-center rounded border', c.correct ? 'bg-primary border-primary' : 'border-border')}
                >
                  {c.correct ? <Check size={14} color="white" /> : null}
                </Pressable>
                <TextInput
                  accessibilityLabel={`Choice ${j + 1}`}
                  value={c.text}
                  onChangeText={(v) => update(d.key, (x) => ({ ...x, choices: x.choices.map((y) => (y.id === c.id ? { ...y, text: v } : y)) }))}
                  className="border-border text-foreground flex-1 rounded-lg border px-3 py-2"
                />
                {d.choices.length > 2 ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={`Remove choice ${j + 1}`} onPress={() => update(d.key, (x) => ({ ...x, choices: x.choices.filter((y) => y.id !== c.id) }))} hitSlop={8} className="p-1">
                    <Trash2 size={16} color={fg} />
                  </Pressable>
                ) : null}
              </View>
            ))}
            {d.choices.length < MAX_CHOICES ? <Pill label="Add a choice" onPress={() => update(d.key, (x) => ({ ...x, choices: [...x.choices, { id: nextChoiceId(x.choices), text: '', correct: false }] }))} /> : null}
            <TextInput
              accessibilityLabel={`Explanation for question ${i + 1}`}
              placeholder="Why the answer is right (optional)"
              value={d.explanation}
              multiline
              onChangeText={(v) => update(d.key, (x) => ({ ...x, explanation: v }))}
              className="border-border text-foreground rounded-xl border p-3"
            />
          </View>
        ))}
        {drafts.length < MAX_QUESTIONS ? <Pill label="Add a question" onPress={() => setDrafts((all) => [...all, blank()])} /> : null}
        {error ? (
          <Text accessibilityRole="alert" className="text-destructive text-sm">
            {error}
          </Text>
        ) : null}
        <Pill label={drafts.length === 1 ? 'Publish 1 question' : `Publish ${drafts.length} questions`} primary disabled={publishing.loading || !!making} onPress={() => void submit()} />
      </ScrollView>
    </View>
  )
}
