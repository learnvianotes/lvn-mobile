import { ScrollView, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { parseMarkdown, type MdBlock, type MdInline } from '@/lib/markdown'

/** Markdown (AI results, Markdown cards) as native views; nothing in it becomes markup (see lib/markdown). */

function Inlines({ content }: { content: MdInline[] }) {
  return (
    <>
      {content.map((n, i) => {
        switch (n.kind) {
          case 'text':
            return n.text
          case 'code':
            return (
              <Text key={i} style={{ fontFamily: 'monospace' }} className="bg-secondary">
                {n.text}
              </Text>
            )
          case 'strong':
            return (
              <Text key={i} style={{ fontWeight: '700' }}>
                <Inlines content={n.children} />
              </Text>
            )
          case 'em':
            return (
              <Text key={i} style={{ fontStyle: 'italic' }}>
                <Inlines content={n.children} />
              </Text>
            )
        }
      })}
    </>
  )
}

function Block({ block, depth }: { block: MdBlock; depth: number }) {
  switch (block.kind) {
    case 'heading':
      return (
        <Text accessibilityRole="header" className={block.level === 1 ? 'text-xl font-bold' : block.level === 2 ? 'text-lg font-bold' : 'text-base font-bold'}>
          <Inlines content={block.content} />
        </Text>
      )
    case 'paragraph':
      return (
        <Text className="text-base leading-6">
          <Inlines content={block.content} />
        </Text>
      )
    case 'code':
      return (
        <View className="bg-secondary overflow-hidden rounded-2xl">
          <ScrollView horizontal>
            <Text className="p-3 font-mono text-sm leading-5">{block.text}</Text>
          </ScrollView>
        </View>
      )
    case 'list':
      return (
        <View className="gap-1" style={{ paddingLeft: depth ? 16 : 4 }}>
          {block.items.map((item, i) => (
            <View key={i} className="flex-row gap-2">
              <Text className="text-muted-foreground w-5 text-base leading-6">{block.ordered ? `${block.start + i}.` : '•'}</Text>
              <View className="flex-1 gap-1">
                {item.map((b, j) => (
                  <Block key={j} block={b} depth={depth + 1} />
                ))}
              </View>
            </View>
          ))}
        </View>
      )
  }
}

export function Markdown({ source }: { source: string }) {
  return (
    <View className="gap-2">
      {parseMarkdown(source).map((b, i) => (
        <Block key={i} block={b} depth={0} />
      ))}
    </View>
  )
}
