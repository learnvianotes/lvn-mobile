import { Check, FileText, Image as ImageIcon, X } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import type { CardType } from '@/lib/contracts/domain/enums'
import { cardAnchor, type CardAnchor, type Doc, type Inline } from '@/lib/contracts/validation'
import { cn } from '@/lib/utils'
import { MediaView } from './MediaView'
import { InlineText, RichDoc } from './RichText'

/** One card, read-only and native (lvn-backend §4.1; the web's render/CardView). Unknown types are skipped. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- card content is checked per type by the API
type Any = any

const CALLOUT: Record<string, string> = { note: 'bg-secondary', info: 'bg-sky-500/10', tip: 'bg-emerald-500/10', warning: 'bg-amber-500/15', danger: 'bg-red-500/10' }

/**
 * `onOpenFile` makes a file card (a PDF) open in the reader; `onAnchor` makes the page chip of a card made from a PDF
 * open the PDF there (ADR-0040). Without them the card only says which page it came from.
 */
export function CardView({ type, content, highlighted, onOpenFile, onAnchor }: { type: CardType; content: unknown; highlighted?: boolean; onOpenFile?: (fileId: string) => void; onAnchor?: (anchor: CardAnchor) => void }) {
  const c = content as Any
  const body = (() => {
    switch (type) {
      case 'text':
        return <RichDoc doc={c.doc as Doc} />
      case 'heading':
        return <InlineText content={c.content as Inline} className={cn('font-bold', c.level === 1 ? 'text-2xl' : c.level === 2 ? 'text-xl' : 'text-lg')} />
      case 'quote':
        return (
          <View className="border-primary/50 gap-1 border-l-4 pl-3">
            <RichDoc doc={c.doc as Doc} />
            {c.attribution ? <Text className="text-muted-foreground text-sm">— {c.attribution}</Text> : null}
          </View>
        )
      case 'callout':
        return (
          <View className={cn('gap-1 rounded-2xl p-3', CALLOUT[c.variant as string] ?? 'bg-secondary')}>
            {c.title ? <Text className="font-semibold">{c.title}</Text> : null}
            <RichDoc doc={c.doc as Doc} />
          </View>
        )
      case 'checklist':
        return (
          <View className="gap-1.5">
            {(c.items as { id: string; checked: boolean; content: Inline }[]).map((item) => (
              <View key={item.id} className="flex-row items-start gap-2">
                <View className={cn('mt-1 size-4 items-center justify-center rounded border', item.checked ? 'bg-primary border-primary' : 'border-border')}>{item.checked ? <Check size={12} color="white" /> : null}</View>
                <InlineText content={item.content} className={cn('flex-1 text-base', item.checked && 'text-muted-foreground line-through')} />
              </View>
            ))}
          </View>
        )
      case 'code':
      case 'markdown':
      case 'diagram':
        return (
          <View className="bg-secondary overflow-hidden rounded-2xl">
            {type === 'code' && (c.filename || c.language) ? <Text className="text-muted-foreground border-border border-b px-3 py-1.5 font-mono text-xs">{c.filename || c.language}</Text> : null}
            <ScrollView horizontal>
              <Text className="p-3 font-mono text-sm leading-5">{type === 'code' ? c.code : c.source}</Text>
            </ScrollView>
          </View>
        )
      case 'table': {
        const rows = c.rows as Inline[][]
        return (
          <ScrollView horizontal>
            <View className="border-border rounded-xl border">
              {rows.map((row, r) => (
                <View key={r} className={cn('flex-row', r > 0 && 'border-border border-t')}>
                  {row.map((cell, i) => (
                    <View key={i} className={cn('w-36 px-2 py-1.5', i > 0 && 'border-border border-l', r === 0 && c.hasHeaderRow && 'bg-secondary')}>
                      <InlineText content={cell} className={cn('text-sm', r === 0 && c.hasHeaderRow && 'font-semibold')} />
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        )
      }
      case 'question':
        return <Question content={c} />
      case 'quiz':
        return <Quiz content={c} />
      case 'flashcard':
        return <Flashcard content={c} />
      case 'file':
        return onOpenFile && c.fileId ? <ReadFile onPress={() => onOpenFile(String(c.fileId))} /> : <MediaView type="file" content={c} />
      case 'image':
      case 'video':
      case 'audio':
        return <MediaView type={type} content={c} />
      default:
        return null
    }
  })()
  if (!body) return null
  const anchor = cardAnchor(content)
  return (
    <View className={cn('rounded-xl', highlighted && 'bg-primary/10')}>
      {body}
      {anchor ? <AnchorChip anchor={anchor} onPress={onAnchor} /> : null}
    </View>
  )
}

/** Where a card came from in a PDF; a button to go there when the screen can open it. */
function AnchorChip({ anchor, onPress }: { anchor: CardAnchor; onPress?: (anchor: CardAnchor) => void }) {
  if (!onPress) return <Text className="text-muted-foreground mt-1 self-end text-xs">From page {anchor.page} of the PDF</Text>
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open the PDF at page ${anchor.page}`} onPress={() => onPress(anchor)} className="border-border mt-1.5 self-end rounded-full border px-2.5 py-1">
      <Text className="text-muted-foreground text-xs font-medium">↗ p. {anchor.page}</Text>
    </Pressable>
  )
}

function ReadFile({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Read and make notes" onPress={onPress} className="bg-primary flex-row items-center gap-3 rounded-2xl px-4 py-3">
      <FileText size={20} color="#ffffff" />
      <View className="flex-1">
        <Text className="text-primary-foreground font-semibold">Read & make notes</Text>
        <Text className="text-primary-foreground/80 text-xs">Open the PDF: highlight and add passages to this note</Text>
      </View>
    </Pressable>
  )
}

function Question({ content }: { content: { prompt: Doc; answer: Doc; hint?: Doc } }) {
  const [shown, setShown] = useState<'none' | 'hint' | 'answer'>('none')
  return (
    <View className="border-border gap-2 rounded-2xl border p-3">
      <RichDoc doc={content.prompt} />
      {shown === 'answer' ? <View className="bg-secondary rounded-xl p-3"><RichDoc doc={content.answer} /></View> : null}
      {shown === 'hint' && content.hint ? <View className="bg-amber-500/10 rounded-xl p-3"><RichDoc doc={content.hint} /></View> : null}
      <View className="flex-row gap-2">
        {content.hint && shown === 'none' ? <Chip label="Show a hint" onPress={() => setShown('hint')} /> : null}
        {shown !== 'answer' ? <Chip label="Show the answer" onPress={() => setShown('answer')} /> : null}
      </View>
    </View>
  )
}

function Quiz({ content }: { content: { question: Doc; choices: { id: string; content: Inline }[]; correct: string[]; multiple: boolean } }) {
  const [picked, setPicked] = useState<string[]>([])
  const [checked, setChecked] = useState(false)
  const right = checked && picked.length === content.correct.length && picked.every((p) => content.correct.includes(p))
  return (
    <View className="border-border gap-2 rounded-2xl border p-3">
      <RichDoc doc={content.question} />
      {content.choices.map((choice) => {
        const on = picked.includes(choice.id)
        const mark = checked && (content.correct.includes(choice.id) ? 'right' : on ? 'wrong' : null)
        return (
          <Pressable
            key={choice.id}
            accessibilityRole={content.multiple ? 'checkbox' : 'radio'}
            accessibilityState={{ checked: on }}
            onPress={() => {
              setChecked(false)
              setPicked((p) => (content.multiple ? (on ? p.filter((x) => x !== choice.id) : [...p, choice.id]) : [choice.id]))
            }}
            className={cn('flex-row items-center gap-2 rounded-xl border px-3 py-2.5', on ? 'border-primary bg-primary/10' : 'border-border', mark === 'right' && 'border-emerald-500 bg-emerald-500/10', mark === 'wrong' && 'border-red-500 bg-red-500/10')}
          >
            <InlineText content={choice.content} className="flex-1 text-base" />
            {mark === 'right' ? <Check size={16} color="#10b981" /> : mark === 'wrong' ? <X size={16} color="#ef4444" /> : null}
          </Pressable>
        )
      })}
      <View className="flex-row items-center gap-3">
        <Chip label="Check" onPress={() => setChecked(true)} disabled={!picked.length} />
        {checked ? <Text className={cn('font-semibold', right ? 'text-emerald-600' : 'text-red-600')}>{right ? 'Correct!' : 'Not quite.'}</Text> : null}
      </View>
    </View>
  )
}

function Flashcard({ content }: { content: { front: Doc; back: Doc } }) {
  const [back, setBack] = useState(false)
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={back ? 'Flashcard, back side' : 'Flashcard, front side'} accessibilityHint={back ? 'Shows the front' : 'Shows the back'} onPress={() => setBack((b) => !b)} className={cn('min-h-28 justify-center gap-2 rounded-2xl p-4', back ? 'bg-primary/10' : 'bg-secondary')}>
      <RichDoc doc={back ? content.back : content.front} />
      <Text className="text-muted-foreground text-xs">{back ? 'Tap to see the front' : 'Tap to see the back'}</Text>
    </Pressable>
  )
}

function Chip({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} className={cn('bg-secondary rounded-full px-3 py-1.5', disabled && 'opacity-50')}>
      <Text className="text-secondary-foreground text-sm font-semibold">{label}</Text>
    </Pressable>
  )
}
