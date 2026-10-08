import { Linking, View, type TextStyle } from 'react-native'
import { Text } from '@/components/ui/text'
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
    else if (m.type === 'highlight') s.backgroundColor = 'rgba(250, 204, 21, 0.35)'
  }
  if (lines.length) s.textDecorationLine = lines.join(' ') as TextStyle['textDecorationLine']
  return s
}

export function InlineText({ content, className }: { content: Inline | undefined; className?: string }) {
  return (
    <Text className={className}>
      {(content ?? []).map((n, i) => {
        if (n.type === 'hardBreak') return '\n'
        const link = n.marks?.find((m) => m.type === 'link') as { attrs?: { href?: string } } | undefined
        return (
          <Text key={i} style={markStyle(n.marks)} className={link ? 'text-primary underline' : undefined} onPress={link?.attrs?.href ? () => void Linking.openURL(link.attrs!.href!) : undefined}>
            {n.text}
          </Text>
        )
      })}
    </Text>
  )
}

function Block({ node, depth }: { node: BlockNode; depth: number }) {
  if (node.type === 'paragraph') return <InlineText content={node.content} className="text-base leading-6" />
  const ordered = node.type === 'orderedList'
  return (
    <View className="gap-1" style={{ paddingLeft: depth ? 16 : 4 }}>
      {node.content.map((item, i) => (
        <View key={i} className="flex-row gap-2">
          <Text className="text-muted-foreground w-5 text-base leading-6">{ordered ? `${i + 1}.` : '•'}</Text>
          <View className="flex-1 gap-1">
            {item.content.map((b, j) => (
              <Block key={j} node={b} depth={depth + 1} />
            ))}
          </View>
        </View>
      ))}
    </View>
  )
}

export function RichDoc({ doc }: { doc: Doc | undefined }) {
  return (
    <View className="gap-2">
      {(doc?.content ?? []).map((b, i) => (
        <Block key={i} node={b} depth={0} />
      ))}
    </View>
  )
}
