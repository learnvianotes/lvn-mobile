import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { Text } from '@/components/ui/text'

/**
 * A code block in the note viewer (a fenced block, a code card, a diagram's source, an Output block).
 * The scroll content is as wide as the longest line and lines are not wrapped, so a long line can be
 * swiped into view instead of being clipped at the card's right edge. The viewport stays the card's
 * width (`width: '100%'`), otherwise the scroller would grow with the line and there would be nothing
 * to scroll. `nestedScrollEnabled` lets Android hand a vertical drag to the note; `directionalLockEnabled`
 * keeps iOS from turning that drag into a sideways scroll.
 */

/** JetBrains Mono's advance is 0.6em. `text-sm` is 14. A little extra so a glyph is not wrapped by rounding or the fallback monospace. */
const CODE_FONT_SIZE = 14
const MONO_ADVANCE = 0.62
/** `p-3` on both sides. React Native `width` on Text includes padding. */
const CODE_PAD_X = 24

function lineColumns(line: string): number {
  let n = 0
  for (const ch of line) n += ch === '\t' ? 4 : 1
  return n
}

/** Width of the scroll content: the longest line, in columns, plus the card's horizontal padding. */
export function codeContentWidth(source: string, fontSize = CODE_FONT_SIZE): number {
  let columns = 0
  for (const line of source.split('\n')) columns = Math.max(columns, lineColumns(line))
  return Math.ceil(columns * fontSize * MONO_ADVANCE) + CODE_PAD_X
}

export function CodeBlock({ code, label }: { code: string; label?: string }) {
  const source = code.replace(/\r\n?/g, '\n')
  const width = codeContentWidth(source)
  const [viewport, setViewport] = useState(0)
  // Before layout, leave scrolling on. After, only when a line is wider than the card, so a short block does not take the note's vertical pan.
  const scrolls = viewport === 0 || width > viewport + 1
  return (
    <View className="bg-secondary overflow-hidden rounded-2xl">
      {label ? <Text className="text-muted-foreground border-border border-b px-3 py-1.5 font-mono text-xs">{label}</Text> : null}
      <ScrollView
        testID="code-block"
        horizontal
        showsHorizontalScrollIndicator
        nestedScrollEnabled
        directionalLockEnabled
        scrollEnabled={scrolls}
        accessibilityHint={scrolls ? 'Swipe sideways to read long lines' : undefined}
        onLayout={(e) => {
          const next = e.nativeEvent.layout.width
          setViewport((prev) => (prev === next ? prev : next))
        }}
        style={{ flexGrow: 0, width: '100%' }}
        contentContainerStyle={{ width }}
      >
        <Text className="p-3 font-mono text-sm leading-5" style={{ width }}>
          {source}
        </Text>
      </ScrollView>
    </View>
  )
}
