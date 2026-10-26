import { Check, Minus, Plus, X } from 'lucide-react-native'
import { Pressable, ScrollView, Switch, TextInput, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { docText, inlineText, type Doc, type Inline } from '@/lib/contracts/validation'
import { cn } from '@/lib/utils'
import { newId } from '../model/ids'

/**
 * The structured cards on the phone (lvn-backend P3m): tables, practice questions, quizzes, flashcards, diagrams and
 * Markdown, and the caption of a picture, video, recording or file. Each field is plain text here; a field keeps the
 * formatting it had on the web until it is changed on the phone.
 */

export type Theme = { fg: string; muted: string; accent: string; border: string }
const field = 'text-foreground border-border bg-background rounded-xl border px-3 py-2.5 text-base'

const toInline = (s: string): Inline => (s ? [{ type: 'text', text: s }] : [])
/** Plain text as a document, one paragraph per line. */
export function textToDoc(text: string): Doc {
  const paragraphs = text.split(/\n/).map((l) => l.trimEnd())
  while (paragraphs.length && !paragraphs.at(-1)) paragraphs.pop()
  return { type: 'doc', content: paragraphs.map((p) => ({ type: 'paragraph', content: p ? [{ type: 'text', text: p }] : [] })) } as Doc
}
const docToText = (doc: Doc | undefined) => (doc?.content ?? []).map((b) => (b.type === 'paragraph' ? inlineText(b.content) : docText({ type: 'doc', content: [b] } as Doc))).join('\n')

function DocField({ label, value, onChange, theme, autoFocus }: { label: string; value: Doc | undefined; onChange: (doc: Doc) => void; theme: Theme; autoFocus?: boolean }) {
  return (
    <View className="gap-1">
      <Text className="text-muted-foreground text-xs font-semibold">{label}</Text>
      <TextInput accessibilityLabel={label} multiline autoFocus={autoFocus} placeholderTextColor={theme.muted} className={cn(field, 'min-h-16')} style={{ textAlignVertical: 'top' }} defaultValue={docToText(value)} onChangeText={(t) => onChange(textToDoc(t))} />
    </View>
  )
}

type Table = { hasHeaderRow: boolean; rows: Inline[][] }
export function TableEditor({ content, onChange, theme }: { content: Table; onChange: (c: Table) => void; theme: Theme }) {
  const rows = content.rows
  const cols = rows[0]?.length ?? 1
  const set = (next: Partial<Table>) => onChange({ ...content, ...next })
  const cell = (r: number, i: number, text: string) => set({ rows: rows.map((row, ri) => (ri === r ? row.map((c, ci) => (ci === i ? toInline(text) : c)) : row)) })
  return (
    <View className="gap-2">
      <ScrollView horizontal keyboardShouldPersistTaps="handled">
        <View className="gap-1">
          {rows.map((row, r) => (
            <View key={r} className="flex-row gap-1">
              {row.map((c, i) => (
                <TextInput key={`${r}-${i}-${cols}`} accessibilityLabel={`Row ${r + 1}, column ${i + 1}`} placeholderTextColor={theme.muted} className={cn(field, 'w-32 py-2 text-sm', r === 0 && content.hasHeaderRow && 'font-semibold')} defaultValue={inlineText(c)} onChangeText={(t) => cell(r, i, t)} />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
      <View className="flex-row flex-wrap items-center gap-2">
        <Step label="Row" count={rows.length} min={1} max={200} onAdd={() => set({ rows: [...rows, Array.from({ length: cols }, () => [])] })} onRemove={() => set({ rows: rows.slice(0, -1) })} theme={theme} />
        <Step label="Column" count={cols} min={1} max={20} onAdd={() => set({ rows: rows.map((row) => [...row, []]) })} onRemove={() => set({ rows: rows.map((row) => row.slice(0, -1)) })} theme={theme} />
        <View className="flex-row items-center gap-2">
          <Text className="text-sm">Header row</Text>
          <Switch accessibilityLabel="Header row" value={content.hasHeaderRow} onValueChange={(hasHeaderRow) => set({ hasHeaderRow })} />
        </View>
      </View>
    </View>
  )
}

function Step({ label, count, min, max, onAdd, onRemove, theme }: { label: string; count: number; min: number; max: number; onAdd: () => void; onRemove: () => void; theme: Theme }) {
  return (
    <View className="bg-secondary flex-row items-center gap-1 rounded-full px-1 py-0.5">
      <Pressable accessibilityRole="button" accessibilityLabel={`Remove a ${label.toLowerCase()}`} disabled={count <= min} onPress={onRemove} className={cn('p-1.5', count <= min && 'opacity-30')}>
        <Minus size={14} color={theme.fg} />
      </Pressable>
      <Text className="text-xs font-semibold">
        {count} {count === 1 ? label.toLowerCase() : `${label.toLowerCase()}s`}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Add a ${label.toLowerCase()}`} disabled={count >= max} onPress={onAdd} className={cn('p-1.5', count >= max && 'opacity-30')}>
        <Plus size={14} color={theme.fg} />
      </Pressable>
    </View>
  )
}

type Question = { prompt: Doc; answer: Doc; hint?: Doc }
export function QuestionEditor({ content, onChange, theme }: { content: Question; onChange: (c: Question) => void; theme: Theme }) {
  return (
    <View className="gap-2">
      <DocField label="Question" value={content.prompt} onChange={(prompt) => onChange({ ...content, prompt })} theme={theme} autoFocus />
      <DocField label="Answer" value={content.answer} onChange={(answer) => onChange({ ...content, answer })} theme={theme} />
      <DocField label="Hint (optional)" value={content.hint} onChange={(hint) => onChange({ ...content, hint: docText(hint).trim() ? hint : undefined })} theme={theme} />
    </View>
  )
}

type Quiz = { question: Doc; choices: { id: string; content: Inline }[]; correct: string[]; multiple: boolean; explanation?: Doc }
export function QuizEditor({ content, onChange, theme }: { content: Quiz; onChange: (c: Quiz) => void; theme: Theme }) {
  const set = (next: Partial<Quiz>) => onChange({ ...content, ...next })
  const toggle = (id: string) => {
    const on = content.correct.includes(id)
    // One right answer unless several are allowed; never none.
    if (!content.multiple) return set({ correct: [id] })
    const correct = on ? content.correct.filter((x) => x !== id) : [...content.correct, id]
    if (correct.length) set({ correct })
  }
  return (
    <View className="gap-2">
      <DocField label="Question" value={content.question} onChange={(question) => set({ question })} theme={theme} autoFocus />
      <Text className="text-muted-foreground text-xs font-semibold">Choices — tick the right {content.multiple ? 'ones' : 'one'}</Text>
      {content.choices.map((choice, i) => {
        const right = content.correct.includes(choice.id)
        return (
          <View key={choice.id} className="flex-row items-center gap-2">
            <Pressable accessibilityRole={content.multiple ? 'checkbox' : 'radio'} accessibilityState={{ checked: right }} accessibilityLabel={`Choice ${i + 1} is right`} onPress={() => toggle(choice.id)} className={cn('size-7 items-center justify-center rounded-full border', right ? 'border-success bg-success' : 'border-border')}>
              {right ? <Check size={14} color="white" /> : null}
            </Pressable>
            <TextInput accessibilityLabel={`Choice ${i + 1}`} placeholder={`Choice ${i + 1}`} placeholderTextColor={theme.muted} className={cn(field, 'flex-1 py-2')} defaultValue={inlineText(choice.content)} onChangeText={(t) => set({ choices: content.choices.map((c) => (c.id === choice.id ? { ...c, content: toInline(t) } : c)) })} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove choice ${i + 1}`}
              disabled={content.choices.length <= 2}
              onPress={() => {
                const correct = content.correct.filter((x) => x !== choice.id)
                set({ choices: content.choices.filter((c) => c.id !== choice.id), correct: correct.length ? correct : [content.choices.find((c) => c.id !== choice.id)!.id] })
              }}
              className={cn('p-1', content.choices.length <= 2 && 'opacity-30')}
            >
              <X size={16} color={theme.muted} />
            </Pressable>
          </View>
        )
      })}
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Pressable accessibilityRole="button" disabled={content.choices.length >= 8} onPress={() => set({ choices: [...content.choices, { id: newId(), content: [] }] })} className="flex-row items-center gap-1.5 rounded-full px-2 py-1">
          <Plus size={16} color={theme.accent} />
          <Text className="text-primary text-sm font-semibold">Add a choice</Text>
        </Pressable>
        <View className="flex-row items-center gap-2">
          <Text className="text-sm">More than one right</Text>
          <Switch accessibilityLabel="More than one right answer" value={content.multiple} onValueChange={(multiple) => set({ multiple, correct: multiple ? content.correct : content.correct.slice(0, 1) })} />
        </View>
      </View>
      <DocField label="Why (shown after checking, optional)" value={content.explanation} onChange={(explanation) => set({ explanation: docText(explanation).trim() ? explanation : undefined })} theme={theme} />
    </View>
  )
}

type Flashcard = { front: Doc; back: Doc }
export function FlashcardEditor({ content, onChange, theme }: { content: Flashcard; onChange: (c: Flashcard) => void; theme: Theme }) {
  return (
    <View className="gap-2">
      <DocField label="Front" value={content.front} onChange={(front) => onChange({ ...content, front })} theme={theme} autoFocus />
      <DocField label="Back" value={content.back} onChange={(back) => onChange({ ...content, back })} theme={theme} />
    </View>
  )
}

export function SourceEditor({ label, content, onChange, theme, caption }: { label: string; content: { source: string; caption?: Inline }; onChange: (c: { source: string; caption?: Inline }) => void; theme: Theme; caption?: boolean }) {
  return (
    <View className="gap-2">
      <TextInput autoFocus multiline accessibilityLabel={label} placeholder={label} placeholderTextColor={theme.muted} autoCapitalize="none" autoCorrect={false} className={cn(field, 'min-h-28 font-mono text-sm')} style={{ textAlignVertical: 'top' }} defaultValue={content.source} onChangeText={(source) => onChange({ ...content, source })} />
      {caption ? <TextInput accessibilityLabel="Caption" placeholder="Caption (optional)" placeholderTextColor={theme.muted} className={field} defaultValue={inlineText(content.caption)} onChangeText={(t) => onChange({ ...content, caption: t ? toInline(t) : undefined })} /> : null}
    </View>
  )
}

/** A picture's description for people who cannot see it, and any media card's caption. */
export function MediaDetailsEditor({ image, content, onChange, theme }: { image: boolean; content: { fileId: string; alt?: string; caption?: Inline }; onChange: (c: object) => void; theme: Theme }) {
  return (
    <View className="gap-2">
      {image ? <TextInput accessibilityLabel="Describe the picture for people who cannot see it" placeholder="Describe the picture for people who cannot see it" placeholderTextColor={theme.muted} className={field} defaultValue={content.alt ?? ''} onChangeText={(alt) => onChange({ ...content, alt })} /> : null}
      <TextInput accessibilityLabel="Caption" placeholder="Caption (optional)" placeholderTextColor={theme.muted} className={field} defaultValue={inlineText(content.caption)} onChangeText={(t) => onChange({ ...content, caption: t ? toInline(t) : undefined })} />
    </View>
  )
}
