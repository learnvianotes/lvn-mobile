import { StyleSheet, View } from 'react-native'
import { screen } from '@testing-library/react-native'
import { CardView } from '@/features/notes/render/CardView'
import { CodeBlock, codeContentWidth } from '@/features/notes/render/CodeBlock'
import { Markdown } from '@/features/notes/render/Markdown'
import { renderInApp } from '../../support/render'

const cpp = 'friend std::ostream& operator<<(std::ostream& os, const Fraction& f);'
const ctor = 'Fraction(int n, int d) : num_(n), den_(d) {}'
const output = '1/2'

it('sizes the scroll content to the longest line, and a tab counts as four columns', () => {
  expect(codeContentWidth(`${ctor}\n${cpp}`)).toBe(codeContentWidth(cpp))
  expect(codeContentWidth(cpp)).toBeGreaterThan(codeContentWidth(ctor))
  expect(codeContentWidth('ab')).toBeGreaterThan(codeContentWidth('a'))
  expect(codeContentWidth('\tab')).toBe(codeContentWidth('    ab'))
  expect(codeContentWidth('abc')).toBe(Math.ceil(3 * 14 * 0.62) + 24)
})

it('puts fenced code, code cards, diagram source and Output in a horizontal scroller that does not wrap', async () => {
  await renderInApp(
    <View>
      <CodeBlock code={cpp} label="cpp" />
      <CardView type="code" content={{ language: 'cpp', filename: 'friend.cpp', code: `${ctor}\n${cpp}` }} />
      <CardView type="code" content={{ language: 'text', filename: 'Output', code: output }} />
      <CardView type="diagram" content={{ syntax: 'mermaid', source: cpp }} />
      <Markdown source={`A friend function.\n\n\`\`\`cpp\n${ctor}\n${cpp}\n\`\`\`\n\n\`\`\`output\n${output}\n\`\`\``} />
    </View>,
  )

  const scrolls = screen.getAllByTestId('code-block')
  // The component, the friend.cpp card, Output, the diagram, the cpp fence, and the output fence.
  expect(scrolls).toHaveLength(6)
  for (const scroll of scrolls) {
    expect(scroll.props.horizontal).toBe(true)
    expect(scroll.props.showsHorizontalScrollIndicator).toBe(true)
    expect(scroll.props.nestedScrollEnabled).toBe(true)
    expect(scroll.props.directionalLockEnabled).toBe(true)
  }

  const friend = screen.getAllByText(`${ctor}\n${cpp}`)
  expect(friend.length).toBeGreaterThanOrEqual(2)
  for (const node of friend) {
    const style = StyleSheet.flatten(node.props.style)
    expect(style.width).toBe(codeContentWidth(`${ctor}\n${cpp}`))
    expect(node.props.numberOfLines).toBeUndefined()
  }
  // The card's scroll content is that same width, so the line is not wrapped down to the card.
  const card = scrolls.find((scroll) => scroll.props.contentContainerStyle?.width === codeContentWidth(`${ctor}\n${cpp}`))
  expect(card?.props.contentContainerStyle).toEqual({ width: codeContentWidth(`${ctor}\n${cpp}`) })
  expect(screen.getByText('Output')).toBeTruthy()
  expect(screen.getByText('friend.cpp')).toBeTruthy()
})
