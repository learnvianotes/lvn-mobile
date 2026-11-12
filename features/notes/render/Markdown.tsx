import type { ReactNode } from 'react'
import { View } from 'react-native'
import { Text } from '@/components/ui/text'
import { parseMarkdown, type MdBlock, type MdInline } from '@/lib/markdown'
import { CodeBlock } from './CodeBlock'

/** Markdown (AI results, Markdown cards) as native views; nothing in it becomes markup (see lib/markdown). */

/** How an answer's `[n]` citations show (Ask AI, lvn-backend ADR-0060); without it they stay text. */
type Cite = (n: number, key: string) => ReactNode
const CITATION = /\[(\d{1,2})\]/g

function withCitations(text: string, key: string, cite: Cite | undefined): ReactNode {
  if (!cite) return text
  const parts: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(CITATION)) {
    parts.push(text.slice(last, m.index))
    parts.push(cite(Number(m[1]), `${key}-${m.index}`))
    last = m.index + m[0].length
  }
  if (!parts.length) return text
  parts.push(text.slice(last))
  return parts
}

function Inlines({ content, cite }: { content: MdInline[]; cite?: Cite }) {
  return (
    <>
      {content.map((n, i) => {
        switch (n.kind) {
          case 'text':
            return withCitations(n.text, String(i), cite)
          case 'code':
            return (
              <Text key={i} style={{ fontFamily: 'monospace' }} className="bg-secondary">
                {n.text}
              </Text>
            )
          case 'strong':
            return (
              <Text key={i} style={{ fontWeight: '700' }}>
                <Inlines content={n.children} cite={cite} />
              </Text>
            )
          case 'em':
            return (
              <Text key={i} style={{ fontStyle: 'italic' }}>
                <Inlines content={n.children} cite={cite} />
              </Text>
            )
        }
      })}
    </>
  )
}

function Block({ block, depth, cite }: { block: MdBlock; depth: number; cite?: Cite }) {
  switch (block.kind) {
    case 'heading':
      return (
        <Text accessibilityRole="header" className={block.level === 1 ? 'text-xl font-bold' : block.level === 2 ? 'text-lg font-bold' : 'text-base font-bold'}>
          <Inlines content={block.content} cite={cite} />
        </Text>
      )
    case 'paragraph':
      return (
        <Text className="text-base leading-6">
          <Inlines content={block.content} cite={cite} />
        </Text>
      )
    case 'code':
      return <CodeBlock code={block.text} />
    case 'list':
      return (
        <View className="gap-1" style={{ paddingLeft: depth ? 16 : 4 }}>
          {block.items.map((item, i) => (
            <View key={i} className="flex-row gap-2">
              <Text className="text-muted-foreground w-5 text-base leading-6">{block.ordered ? `${block.start + i}.` : '•'}</Text>
              <View className="flex-1 gap-1">
                {item.map((b, j) => (
                  <Block key={j} block={b} depth={depth + 1} cite={cite} />
                ))}
              </View>
            </View>
          ))}
        </View>
      )
  }
}

export function Markdown({ source, cite }: { source: string; cite?: Cite }) {
  return (
    <View className="gap-2">
      {parseMarkdown(source).map((b, i) => (
        <Block key={i} block={b} depth={0} cite={cite} />
      ))}
    </View>
  )
}
