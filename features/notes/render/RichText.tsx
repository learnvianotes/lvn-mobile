import { router } from 'expo-router'
import type { ReactNode } from 'react'
import { Linking, View, type TextStyle } from 'react-native'
import { Text } from '@/components/ui/text'
import { getTheme } from '@/lib/theme/store'
import type { BlockNode, Doc, Inline, Mark } from '@/lib/contracts/validation'

/** Tiptap/ProseMirror JSON (validated by the API, @lvn/contracts rich-text) drawn with native text. */

const markStyle = (marks: readonly Mark[] | undefined): TextStyle => {
  const s: TextStyle = {}
  const lines: string[] = []
  for (const m of marks ?? []) {
    if (m.type === 'bold') s.fontWeight = '700'
    else if (m.type === 'italic') s.fontStyle = 'italic'
    else if (m.type === 'underline') lines.push('underline')
    else if (m.type === 'strike') lines.push('line-through')
    else if (m.type === 'code') s.fontFamily = 'monospace'
    else if (m.type === 'highlight') s.backgroundColor = getTheme().palette.highlight
  }
  if (lines.length) s.textDecorationLine = lines.join(' ') as TextStyle['textDecorationLine']
  return s
}

/** Comments and posts link `@handle` to the person's profile (lvn-backend ADR-0054); note content does not. */
const MENTION = /(^|[^A-Za-z0-9@.])@([A-Za-z0-9]{3,40})\b/g

function withMentions(text: string, key: number): ReactNode {
  const parts: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(MENTION)) {
    const at = m.index! + m[1]!.length
    parts.push(text.slice(last, at))
    const handle = m[2]!.toLowerCase()
    parts.push(
      <Text key={`${key}-${at}`} accessibilityRole="link" className="text-primary font-semibold" onPress={() => router.push(`/u/${handle}`)}>
        @{m[2]}
      </Text>,
    )
    last = at + 1 + m[2]!.length
  }
  if (!parts.length) return text
  parts.push(text.slice(last))
  return parts
}

export function InlineText({ content, className, mentions = false }: { content: Inline | undefined; className?: string; mentions?: boolean }) {
  return (
    <Text className={className}>
      {(content ?? []).map((n, i) => {
        if (n.type === 'hardBreak') return '\n'
        const link = n.marks?.find((m) => m.type === 'link') as { attrs?: { href?: string } } | undefined
        const plain = mentions && !link && !n.marks?.some((m) => m.type === 'code')
        return (
          <Text key={i} style={markStyle(n.marks)} className={link ? 'text-primary underline' : undefined} onPress={link?.attrs?.href ? () => void Linking.openURL(link.attrs!.href!) : undefined}>
            {plain ? withMentions(n.text, i) : n.text}
          </Text>
        )
      })}
    </Text>
  )
}

function Block({ node, depth, mentions }: { node: BlockNode; depth: number; mentions: boolean }) {
  if (node.type === 'paragraph') return <InlineText content={node.content} className="text-base leading-6" mentions={mentions} />
  const ordered = node.type === 'orderedList'
  return (
    <View className="gap-1" style={{ paddingLeft: depth ? 16 : 4 }}>
      {node.content.map((item, i) => (
        <View key={i} className="flex-row gap-2">
          <Text className="text-muted-foreground w-5 text-base leading-6">{ordered ? `${i + 1}.` : '•'}</Text>
          <View className="flex-1 gap-1">
            {item.content.map((b, j) => (
              <Block key={j} node={b} depth={depth + 1} mentions={mentions} />
            ))}
          </View>
        </View>
      ))}
    </View>
  )
}

export function RichDoc({ doc, mentions = false }: { doc: Doc | undefined; mentions?: boolean }) {
  return (
    <View className="gap-2">
      {(doc?.content ?? []).map((b, i) => (
        <Block key={i} node={b} depth={0} mentions={mentions} />
      ))}
    </View>
  )
}
