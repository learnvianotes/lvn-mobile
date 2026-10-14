import { Check, Plus, X } from 'lucide-react-native'
import { useRef } from 'react'
import { Pressable, TextInput, View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import type { Inline } from '@/lib/contracts/validation'
import { inlineText } from '@/lib/contracts/validation'
import { cn } from '@/lib/utils'
import { newId } from '../model/ids'
import type { LocalCard } from '../model/types'
import { MediaView } from '../render/MediaView'
import RichTextEditor from './RichTextEditor'
import { FlashcardEditor, MediaDetailsEditor, QuestionEditor, QuizEditor, SourceEditor, TableEditor } from './StructuredEditors'

/**
 * Editing one card on the phone. Rich text (text, quote, callout) uses the DOM editor; headings, code, checklists and
 * the structured cards (tables, questions, quizzes, flashcards, diagrams, Markdown) are native fields, and media cards
 * take a description and a caption (lvn-backend P3m). Every card type is edited here.
 */
export const PHONE_EDITABLE = new Set(['text', 'heading', 'quote', 'callout', 'checklist', 'code', 'table', 'question', 'quiz', 'flashcard', 'diagram', 'markdown', 'image', 'video', 'audio', 'file'])

const toInline = (s: string): Inline => (s ? [{ type: 'text', text: s }] : [])

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- card content is checked per type before it is sent
type Any = any

export function CardEditor({ card, onChange: save }: { card: LocalCard; onChange: (content: unknown) => void }) {
  const c = card.content as Any
  // Each field writes the card's content as it was drawn, with its own change. Two quick edits (the front, then the
  // back) before the first was saved and read back would undo each other, so each write keeps only what it changed,
  // put onto the content as last written here (as on the web, lvn-backend ADR-0076).
  const latest = useRef<{ id: string; content: Any }>({ id: card.id, content: c })
  if (latest.current.id !== card.id) latest.current = { id: card.id, content: c }
  const onChange = (next: Any) => {
    const merged: Any = { ...latest.current.content }
    for (const k of new Set([...Object.keys(c ?? {}), ...Object.keys(next ?? {})])) if (next?.[k] !== c?.[k]) merged[k] = next?.[k]
    latest.current = { id: card.id, content: merged }
    save(merged)
  }
  const color = (name: string, fallback: string) => String(useCSSVariable(name) ?? fallback)
  const theme = {
    fg: color('--color-foreground', '#111827'),
    muted: color('--color-muted-foreground', '#6b7280'),
    accent: color('--color-primary', '#4f46e5'),
    bg: color('--color-background', '#ffffff'),
    surface: color('--color-secondary', '#f3f4f6'),
    border: color('--color-border', '#e5e7eb'),
  }
  const field = 'text-foreground border-border bg-background rounded-xl border px-3 py-2.5 text-base'

  switch (card.type) {
    case 'text':
    case 'quote':
    case 'callout':
      return (
        <View className="gap-2">
          {card.type === 'callout' ? <TextInput accessibilityLabel="Callout title" placeholder="Title (optional)" placeholderTextColor={theme.muted} className={field} defaultValue={c.title ?? ''} onChangeText={(title) => onChange({ ...c, ...(title ? { title } : { title: undefined }) })} /> : null}
          <RichTextEditor
            key={card.id}
            initial={c.doc}
            placeholder={card.type === 'quote' ? 'A quotation' : 'Write here…'}
            label={card.type === 'quote' ? 'Quotation' : card.type === 'callout' ? 'Callout text' : 'Card text'}
            theme={theme}
            autoFocus
            onChange={async (doc) => onChange({ ...c, doc })}
            dom={{ matchContents: true, scrollEnabled: false }}
          />
          {card.type === 'quote' ? <TextInput accessibilityLabel="Who said it" placeholder="Who said it (optional)" placeholderTextColor={theme.muted} className={field} defaultValue={c.attribution ?? ''} onChangeText={(attribution) => onChange({ ...c, attribution: attribution || undefined })} /> : null}
        </View>
      )
    case 'heading':
      return (
        <View className="gap-2">
          <View className="flex-row gap-2">
            {[1, 2, 3].map((level) => (
              <Pressable key={level} accessibilityRole="radio" accessibilityState={{ checked: c.level === level }} accessibilityLabel={`Heading level ${level}`} onPress={() => onChange({ ...c, level })} className={cn('rounded-full px-3 py-1.5', c.level === level ? 'bg-primary' : 'bg-secondary')}>
                <Text className={cn('text-sm font-bold', c.level === level ? 'text-primary-foreground' : 'text-secondary-foreground')}>H{level}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput autoFocus accessibilityLabel="Heading" placeholder="Heading" placeholderTextColor={theme.muted} className={cn(field, 'text-xl font-bold')} defaultValue={inlineText(c.content)} onChangeText={(t) => onChange({ ...c, content: toInline(t) })} />
        </View>
      )
    case 'code':
      return (
        <View className="gap-2">
          <TextInput accessibilityLabel="Language" placeholder="Language, e.g. python" placeholderTextColor={theme.muted} autoCapitalize="none" autoCorrect={false} className={field} defaultValue={c.language ?? ''} onChangeText={(t) => onChange({ ...c, language: t.toLowerCase().replace(/[^a-z0-9+#.-]/g, '') })} />
          <TextInput autoFocus multiline accessibilityLabel="Code" placeholder="Code" placeholderTextColor={theme.muted} autoCapitalize="none" autoCorrect={false} className={cn(field, 'min-h-28 font-mono text-sm')} style={{ textAlignVertical: 'top' }} defaultValue={c.code ?? ''} onChangeText={(code) => onChange({ ...c, code })} />
        </View>
      )
    case 'checklist': {
      const items = (c.items as { id: string; checked: boolean; content: Inline }[]) ?? []
      const set = (next: typeof items) => onChange({ ...c, items: next })
      return (
        <View className="gap-2">
          {items.map((item, i) => (
            <View key={item.id} className="flex-row items-center gap-2">
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: item.checked }} accessibilityLabel={`Item ${i + 1} done`} onPress={() => set(items.map((x) => (x.id === item.id ? { ...x, checked: !x.checked } : x)))} className={cn('size-6 items-center justify-center rounded-md border', item.checked ? 'bg-primary border-primary' : 'border-border')}>
                {item.checked ? <Check size={14} color="white" /> : null}
              </Pressable>
              <TextInput accessibilityLabel={`Item ${i + 1}`} placeholder="To do" placeholderTextColor={theme.muted} className={cn(field, 'flex-1 py-2')} defaultValue={inlineText(item.content)} onChangeText={(t) => set(items.map((x) => (x.id === item.id ? { ...x, content: toInline(t) } : x)))} />
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove item ${i + 1}`} onPress={() => set(items.filter((x) => x.id !== item.id))} className="p-1">
                <X size={16} color={theme.muted} />
              </Pressable>
            </View>
          ))}
          <Pressable accessibilityRole="button" onPress={() => set([...items, { id: newId(), checked: false, content: [] }])} className="flex-row items-center gap-1.5 self-start rounded-full px-2 py-1">
            <Plus size={16} color={theme.accent} />
            <Text className="text-primary text-sm font-semibold">Add an item</Text>
          </Pressable>
        </View>
      )
    }
    case 'table':
      return <TableEditor content={c} onChange={onChange} theme={theme} />
    case 'question':
      return <QuestionEditor content={c} onChange={onChange} theme={theme} />
    case 'quiz':
      return <QuizEditor content={c} onChange={onChange} theme={theme} />
    case 'flashcard':
      return <FlashcardEditor content={c} onChange={onChange} theme={theme} />
    case 'diagram':
      return <SourceEditor label="Mermaid diagram" content={c} onChange={(next) => onChange({ ...c, ...next })} theme={theme} caption />
    case 'markdown':
      return <SourceEditor label="Markdown" content={c} onChange={(next) => onChange({ ...c, ...next })} theme={theme} />
    case 'image':
    case 'video':
    case 'audio':
    case 'file':
      return (
        <View className="gap-2">
          <MediaView type={card.type} content={c} />
          <MediaDetailsEditor image={card.type === 'image'} content={c} onChange={onChange} theme={theme} />
        </View>
      )
    default:
      return null
  }
}
