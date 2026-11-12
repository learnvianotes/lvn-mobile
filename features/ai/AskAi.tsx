import { useMutation, useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { Globe, MessageCircleQuestion, NotebookPen, Sparkles, Trash2, Users, type LucideIcon } from 'lucide-react-native'
import { useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { attempt } from '@/features/groups/shared'
import { Markdown } from '@/features/notes/render/Markdown'
import { useLive } from '@/features/notifications/live'
import { Outcome, Pill, ScreenHeader } from '@/features/shell/Form'
import { AiAnswerDocument, AiStateDocument, AskAiAboutDoubtDocument, AskAiDocument, DeleteAiAnswerDocument, MyAiAnswersDocument, type AiAnswerFieldsFragment, type AskAiScope, type AiUnavailableReason } from '@/graphql/generated/graphql'
import { cn } from '@/lib/utils'

/**
 * Ask AI on the phone (lvn-backend ADR-0060; the web's features/ai/AskAi): a question over the notes the asker may
 * read — one note, their notes, their groups' and classes', public notes, or a workspace's from one of its doubts —
 * answered with the sources it cites. Answers grow while the model writes: the live channel says when (AI_ANSWER), and
 * polling covers a closed socket.
 */

type Answer = AiAnswerFieldsFragment
const POLL_MS = 2000
const OFF: Record<AiUnavailableReason, string> = {
  NOT_CONFIGURED: 'AI isn’t switched on here yet.',
  BUDGET: 'AI is resting until next month: this month’s AI budget is used up.',
  PROVIDER_DOWN: 'The AI model isn’t answering right now. Try again in a minute.',
}

/** Keeps a running answer fresh until it is READY or FAILED; updates reach every list through the cache. */
function Follow({ id }: { id: string }) {
  const { refetch } = useQuery(AiAnswerDocument, { variables: { id }, pollInterval: POLL_MS, fetchPolicy: 'network-only' })
  useLive((signal) => {
    if ((signal.kind === 'AI_ANSWER' && signal.id === id) || signal.kind === 'RECONNECTED') void refetch().catch(() => undefined)
  })
  return null
}

/** A question box, or for a doubt one button: the doubt is the question. */
/** `offNotice` false: the screen already says AI is off. */
export function AskForm({ scope, noteId, doubtId, offNotice = true }: { scope: AskAiScope; noteId?: string; doubtId?: string; offNotice?: boolean }) {
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#3d4b63')
  const state = useQuery(AiStateDocument, { fetchPolicy: 'cache-and-network' })
  const [askAi, asking] = useMutation(AskAiDocument, { refetchQueries: ['MyAiAnswers'] })
  const [askDoubt, askingDoubt] = useMutation(AskAiAboutDoubtDocument, { refetchQueries: ['MyAiAnswers'] })
  const [question, setQuestion] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const status = state.data?.aiStatus
  const off = status ? !status.available : false
  const busy = asking.loading || askingDoubt.loading
  const submit = async () => {
    setMessage(null)
    const problem = await attempt(() => (doubtId ? askDoubt({ variables: { doubtId } }) : askAi({ variables: { input: { question: question.trim(), scope, noteId } } })), 'That didn’t work. Try again.')
    if (problem) return setMessage({ ok: false, text: problem })
    setQuestion('')
  }
  return (
    <View className="gap-2">
      {doubtId ? (
        <View className="flex-row">
          <Pill label="Ask AI about this doubt" primary disabled={off || busy} onPress={() => void submit()} />
        </View>
      ) : (
        <>
          <Text className="text-sm font-semibold">{scope === 'THIS_NOTE' ? 'Ask about this note' : 'Your question'}</Text>
          <TextInput
            accessibilityLabel={scope === 'THIS_NOTE' ? 'Ask about this note' : 'Your question'}
            value={question}
            onChangeText={setQuestion}
            editable={!off}
            multiline
            maxLength={1000}
            placeholder={scope === 'THIS_NOTE' ? 'What does this note say about…?' : 'What would you like to know?'}
            placeholderTextColor={muted}
            className="border-border bg-card text-foreground min-h-16 rounded-2xl border px-3 py-2 text-base"
          />
          <View className="flex-row">
            <Pill label={busy ? 'Asking…' : 'Ask'} primary disabled={off || busy || question.trim().length < 3} onPress={() => void submit()} />
          </View>
        </>
      )}
      {off && offNotice ? <Text className="text-muted-foreground text-xs">{OFF[status?.reason ?? 'NOT_CONFIGURED']}</Text> : null}
      <Outcome message={message} />
    </View>
  )
}

/** One answer: the question, the text with its citations, and the sources they point to. */
export function AnswerCard({ answer: a }: { answer: Answer }) {
  const fg = String(useCSSVariable('--color-foreground') ?? '#152033')
  const primary = String(useCSSVariable('--color-primary') ?? '#1e4d8c')
  const [remove, removing] = useMutation(DeleteAiAnswerDocument, { refetchQueries: ['MyAiAnswers'] })
  const pending = a.status === 'QUEUED' || a.status === 'RUNNING'
  const cited = new Set(a.sources.map((s) => s.n))
  return (
    <View accessibilityLabel={`Answer: ${a.question}`} className="bg-card border-border gap-3 rounded-2xl border p-4">
      <View className="flex-row items-start gap-2">
        <MessageCircleQuestion size={16} color={primary} />
        <Text className="flex-1 font-semibold">{a.question}</Text>
        {pending ? null : (
          <Pressable accessibilityRole="button" accessibilityLabel="Delete this answer" disabled={removing.loading} onPress={() => void attempt(() => remove({ variables: { id: a.id } }))} className="rounded-full p-1">
            <Trash2 size={18} color={fg} />
          </Pressable>
        )}
      </View>
      {pending ? (
        <View accessibilityLiveRegion="polite" className="flex-row items-center gap-2">
          <Follow id={a.id} />
          <ActivityIndicator size="small" />
          <Text className="text-muted-foreground text-sm">{a.status === 'QUEUED' ? 'Waiting its turn…' : 'Writing…'}</Text>
        </View>
      ) : null}
      {a.text ? (
        <Markdown
          source={a.text}
          cite={(n, key) => (
            <Text key={key} accessibilityLabel={`Source ${n}`} className={cn('text-xs font-bold', cited.has(n) ? 'text-primary' : 'text-muted-foreground')}>
              {` [${n}]`}
            </Text>
          )}
        />
      ) : null}
      {a.status === 'FAILED' ? (
        <Text accessibilityRole="alert" className="text-destructive text-sm">
          {a.error ?? 'That didn’t work. Try again.'}
        </Text>
      ) : null}
      {a.status === 'READY' && a.sources.length ? (
        <View className="gap-2">
          <Text accessibilityRole="header" className="text-muted-foreground text-xs font-bold uppercase tracking-wide">
            Sources
          </Text>
          {a.sources.map((s) => (
            <Pressable key={s.n} accessibilityRole="link" accessibilityLabel={`Source ${s.n}: ${s.title || 'Untitled note'}`} onPress={() => router.push(`/notes/${s.noteId}`)} className="border-border bg-background flex-row gap-3 rounded-xl border p-3">
              <View className="bg-primary/10 size-6 items-center justify-center rounded-md">
                <Text className="text-primary text-xs font-bold">{s.n}</Text>
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="font-semibold" numberOfLines={1}>
                  {s.title || 'Untitled note'}
                  {s.versionId ? '' : ' · draft'}
                </Text>
                <Text className="text-muted-foreground text-sm" numberOfLines={2}>
                  {s.snippet}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  )
}

/** The asker's answers, newest first: about one note, one doubt, or everything. */
export function AnswerList({ noteId, doubtId, emptyText }: { noteId?: string; doubtId?: string; emptyText?: string }) {
  const { data } = useQuery(MyAiAnswersDocument, { variables: { first: 20, noteId: noteId ?? null, doubtId: doubtId ?? null }, fetchPolicy: 'cache-and-network' })
  const answers = data?.myAiAnswers ?? []
  if (!data) return null
  if (!answers.length) return emptyText ? <Text className="text-muted-foreground text-sm">{emptyText}</Text> : null
  return (
    <View className="gap-3">
      {answers.map((a) => (
        <AnswerCard key={a.id} answer={a} />
      ))}
    </View>
  )
}

const SCOPES: { scope: AskAiScope; label: string; hint: string; icon: LucideIcon }[] = [
  { scope: 'MY_NOTES', label: 'My notes', hint: 'Your published notes. A note you have never published is not searched yet.', icon: NotebookPen },
  { scope: 'MY_PLACES', label: 'My groups and classes', hint: 'Notes shared with the groups and classes you are in.', icon: Users },
  { scope: 'PUBLIC', label: 'Public notes', hint: 'Notes anyone can read on LearnViaNotes.', icon: Globe },
]

/** The Ask AI screen: questions over the asker's notes, their groups' and classes', or public notes. */
export function AskScreen() {
  const insets = useSafeAreaInsets()
  const primary = String(useCSSVariable('--color-primary') ?? '#1e4d8c')
  const fg = String(useCSSVariable('--color-foreground') ?? '#152033')
  const [scope, setScope] = useState<AskAiScope>('MY_NOTES')
  const current = SCOPES.find((s) => s.scope === scope)!
  return (
    <View className="bg-background flex-1">
      <ScreenHeader title="Ask AI" right={<Sparkles size={20} color={primary} />} />
      <ScrollView nestedScrollEnabled contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
        <Text className="text-muted-foreground text-sm">Ask a question and get an answer from notes you can read, with the notes it came from.</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel="Where to look" className="flex-row flex-wrap gap-2">
          {SCOPES.map(({ scope: s, label, icon: Icon }) => (
            <Pressable key={s} accessibilityRole="radio" accessibilityState={{ checked: scope === s }} accessibilityLabel={label} onPress={() => setScope(s)} className={cn('flex-row items-center gap-1.5 rounded-full border px-3 py-1.5', scope === s ? 'border-primary bg-primary/10' : 'border-border')}>
              <Icon size={15} color={scope === s ? primary : fg} />
              <Text className={cn('text-sm', scope === s && 'text-primary font-semibold')}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Text className="text-muted-foreground text-xs">{current.hint}</Text>
        <AskForm scope={scope} />
        <Text accessibilityRole="header" className="text-muted-foreground text-xs font-bold uppercase tracking-wide">
          Your questions
        </Text>
        <AnswerList emptyText="No questions yet." />
      </ScrollView>
    </View>
  )
}
