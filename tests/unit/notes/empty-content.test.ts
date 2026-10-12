import { emptyContent } from '@/features/notes/store/actions'
import { parseCardContent } from '@/lib/contracts/validation'

jest.mock('@/features/notes/store/db', () => ({}))

/**
 * A card added on the phone is sent as soon as it is valid (lvn-backend §13.2): the structured cards start valid, so a
 * table, question, quiz, flashcard or diagram reaches the server even before it is filled in (P3m).
 */
it.each(['table', 'question', 'quiz', 'flashcard', 'diagram', 'markdown', 'heading', 'checklist', 'code'] as const)('a new %s is valid as it starts', (type) => {
  const parsed = parseCardContent(type, emptyContent(type))
  expect(parsed.ok ? true : parsed.message).toBe(true)
})

it('a new quiz has two different choices, one of them right', () => {
  const quiz = emptyContent('quiz') as { choices: { id: string }[]; correct: string[] }
  expect(new Set(quiz.choices.map((c) => c.id)).size).toBe(2)
  expect(quiz.correct).toEqual([quiz.choices[0]!.id])
})
