import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import { ClassScreen } from '@/features/classes/ClassScreen'
import { QuizBuilderScreen } from '@/features/classes/quizzes/QuizBuilderScreen'
import { QuizScreen } from '@/features/classes/quizzes/QuizScreen'
import { createApolloClient } from '@/lib/apollo'
import { mockApi } from '../../support/api'
import { renderInApp } from '../../support/render'

/**
 * Classroom quizzes on the phone (lvn-backend ADR-0064): the class's Quizzes tab, taking a quiz without its answers and
 * reading them after, a dropped submission sent again as the same attempt, and a teacher making questions from a
 * note with AI, editing them and publishing.
 */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }))
jest.mock('@/features/notes/store/db', () => ({
  listNotes: jest.fn(async () => [
    { id: '01920000-0000-7000-8000-00000000a001', title: 'Respiration notes', localOnly: false },
    { id: '01920000-0000-7000-8000-00000000a002', title: 'Not synced yet', localOnly: true },
  ]),
  subscribe: () => () => {},
}))

const CLASS = '01920000-0000-7000-8000-0000000c0001'
const QUIZ = '01920000-0000-7000-8000-0000000c0a01'
const NOTE = '01920000-0000-7000-8000-00000000a001'
const ART = '01920000-0000-7000-8000-0000000a1001'
const [Q1, Q2] = ['01920000-0000-7000-8000-0000000c0b01', '01920000-0000-7000-8000-0000000c0b02']
const doc = (s: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] })
const inline = (s: string) => [{ type: 'text', text: s }]
const can = (over: Record<string, boolean> = {}) => ({ __typename: 'ClassroomActions', publishQuiz: false, requestJoin: false, acceptInvite: false, review: false, post: false, manage: false, leave: false, ...over })
const classroom = { __typename: 'Classroom', id: CLASS, name: 'Biology 10A', description: null, memberCount: 31, viewerRole: 'STUDENT', teacher: { __typename: 'User', id: 't1', displayName: 'Meera Iyer' }, createdAt: '2026-10-01T10:00:00.000Z', joinCode: null, viewerRequestId: null, viewerInviteId: null, viewerCan: can({ leave: true }) }
type Attempt = { id: string; score: number; total: number; answers: { questionId: string; choiceIds: string[]; correct: boolean }[] }
const quiz = (attempts: Attempt[]) => {
  const shown = attempts.length > 0
  return {
    __typename: 'ClassQuiz', id: QUIZ, classroomId: CLASS, title: 'Respiration', publishedAt: '2026-10-13T09:00:00.000Z', questionCount: 2, submittedCount: null, viewerCanDelete: false,
    author: { __typename: 'User', id: 't1', displayName: 'Meera Iyer' },
    myAttempts: attempts.map((a) => ({ __typename: 'QuizAttempt', submittedAt: '2026-10-13T10:00:00.000Z', ...a, answers: a.answers.map((x) => ({ __typename: 'QuizAnswer', ...x })) })),
    questions: [
      { __typename: 'ClassQuizQuestion', id: Q1, position: 0, question: doc('What makes most of the ATP?'), choices: [{ __typename: 'ClassQuizChoice', id: 'c1', content: inline('Mitochondria') }, { __typename: 'ClassQuizChoice', id: 'c2', content: inline('Ribosomes') }], multiple: false, correct: shown ? ['c1'] : null, explanation: shown ? doc('Respiration happens there.') : null },
      // Choice ids repeat across questions, as in quizzes made with AI: each question shows its own choices.
      { __typename: 'ClassQuizQuestion', id: Q2, position: 1, question: doc('Which are products?'), choices: [{ __typename: 'ClassQuizChoice', id: 'c1', content: inline('Water') }, { __typename: 'ClassQuizChoice', id: 'c2', content: inline('Oxygen') }, { __typename: 'ClassQuizChoice', id: 'c3', content: inline('Carbon dioxide') }], multiple: true, correct: shown ? ['c1', 'c3'] : null, explanation: null },
    ],
  }
}
const inApollo = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)

beforeEach(() => jest.clearAllMocks())

it('a member sees the class’s quizzes with their score and opens one', async () => {
  mockApi({
    Classroom: () => ({ data: { classroom } }),
    ClassroomPosts: () => ({ data: { classroom: { __typename: 'Classroom', id: CLASS, posts: { __typename: 'ClassroomPostConnection', edges: [], pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: null } } } } }),
    ClassroomQuizzes: () => ({ data: { classroom: { __typename: 'Classroom', id: CLASS, quizzes: [quiz([{ id: 'att1', score: 1, total: 2, answers: [] }])] } } }),
  })
  await inApollo(<ClassScreen id={CLASS} />)
  await fireEvent.press(await screen.findByRole('tab', { name: 'Quizzes' }))
  expect(await screen.findByText('Your score: 1 of 2')).toBeOnTheScreen()
  expect(screen.queryByRole('button', { name: 'New quiz' })).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: 'Open Respiration' }))
  expect(router.push).toHaveBeenCalledWith(`/classes/${CLASS}/quizzes/${QUIZ}`)
})

it('takes a quiz without its answers, one question at a time; a dropped submission is sent again as the same attempt; then reads the answers and practises', async () => {
  let attempts: Attempt[] = []
  let drop = true
  const api = mockApi({
    ClassQuiz: () => ({ data: { classQuiz: quiz(attempts) } }),
    SubmitQuizAttempt: (v) => {
      if (drop) return ((drop = false), new Error('Network request failed'))
      const answers = (v.input as { answers: { questionId: string; choiceIds: string[] }[] }).answers
      const right = (id: string, chosen: string[]) => (id === Q1 ? chosen.join() === 'c1' : [...chosen].sort().join() === 'c1,c3')
      const attempt = { id: `att${attempts.length + 1}`, score: answers.filter((a) => right(a.questionId, a.choiceIds)).length, total: 2, answers: answers.map((a) => ({ ...a, correct: right(a.questionId, a.choiceIds) })) }
      attempts = [attempt, ...attempts]
      return { data: { submitQuizAttempt: { __typename: 'QuizAttemptPayload', attempt: { __typename: 'QuizAttempt', id: attempt.id, score: attempt.score, total: attempt.total }, quiz: quiz(attempts), userErrors: [] } } }
    },
  })
  await inApollo(<QuizScreen quizId={QUIZ} />)
  expect(await screen.findByText('Respiration')).toBeOnTheScreen()
  expect(screen.queryByText('Respiration happens there.')).toBeNull()
  // One question at a time: 1/2, Next, no Previous and no Submit yet.
  expect(screen.getByLabelText('Question 1 of 2')).toBeOnTheScreen()
  expect(screen.getByText('1/2')).toBeOnTheScreen()
  expect(screen.queryByRole('button', { name: 'Previous' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Submit answers' })).toBeNull()
  expect(screen.queryByRole('checkbox', { name: 'Water' })).toBeNull()
  await fireEvent.press(screen.getByRole('radio', { name: 'Mitochondria' }))
  expect(screen.getByText('1 of 2 answered')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Next' }))
  expect(screen.queryByRole('radio', { name: 'Mitochondria' })).toBeNull()
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Water' }))
  expect(screen.getByText('Pick every correct answer.')).toBeOnTheScreen()
  // Back and forth, by Previous and by number: the answers stay.
  await fireEvent.press(screen.getByRole('button', { name: 'Previous' }))
  expect(screen.getByRole('radio', { name: 'Mitochondria' })).toBeChecked()
  await fireEvent.press(screen.getByRole('button', { name: 'Question 2, answered' }))
  expect(screen.getByRole('checkbox', { name: 'Water' })).toBeChecked()
  expect(screen.queryByRole('button', { name: 'Next' })).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: 'Submit answers' }))
  expect(await screen.findByText('Your answers were not sent. Check the connection and submit again.')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Submit answers' }))
  expect(await screen.findByText('You got 1 of 2')).toBeOnTheScreen()
  const sent = api.calls.filter((c) => c.op === 'SubmitQuizAttempt').map((c) => c.variables.input as { clientOpId: string; answers: unknown })
  expect(sent).toHaveLength(2)
  expect(sent[1]!.clientOpId).toBe(sent[0]!.clientOpId)
  expect(sent[1]!.answers).toEqual([{ questionId: Q1, choiceIds: ['c1'] }, { questionId: Q2, choiceIds: ['c1'] }])
  expect(screen.getByLabelText('Question 1: right')).toBeOnTheScreen()
  expect(screen.getByLabelText('Question 2: wrong')).toBeOnTheScreen()
  expect(screen.getByText('Respiration happens there.')).toBeOnTheScreen()

  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }))
  expect(screen.getByText('Practice: your first attempt stays your score.')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('radio', { name: 'Mitochondria' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Next' }))
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Water' }))
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Carbon dioxide' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Submit answers' }))
  expect(await screen.findByText('You got 2 of 2')).toBeOnTheScreen()
  expect(screen.getByText('Your score is your first attempt: 1 of 2')).toBeOnTheScreen()
  const third = api.calls.filter((c) => c.op === 'SubmitQuizAttempt').at(-1)!.variables.input as { clientOpId: string }
  expect(third.clientOpId).not.toBe(sent[0]!.clientOpId)
})

it('a teacher makes questions from a synced note with AI, edits them, adds one by hand and publishes', async () => {
  const card = (question: string, choices: string[], correct: string[]) => ({ __typename: 'AiCard', type: 'quiz', content: { question: doc(question), choices: choices.map((c, i) => ({ id: `c${i + 1}`, content: inline(c) })), correct, multiple: correct.length > 1 } })
  const artifact = (over: Record<string, unknown>) => ({ __typename: 'AiArtifact', id: ART, task: 'QUIZ', status: 'QUEUED', language: 'ENGLISH', markdown: null, title: null, cards: null, changes: null, error: null, fromPublishedVersion: false, truncated: false, keptAt: null, createdAt: '2026-10-13T10:00:00.000Z', ...over })
  const api = mockApi({
    RunAiTask: () => ({ data: { runAiTask: { __typename: 'AiArtifactPayload', artifact: artifact({}), userErrors: [] } } }),
    AiArtifact: () => ({ data: { aiArtifact: artifact({ status: 'READY', cards: [card('What makes ATP?', ['Mitochondria', 'Ribosomes'], ['c1']), card('Where is glycolysis?', ['Matrix', 'Cytoplasm'], ['c2'])] }) } }),
    PublishClassQuiz: () => ({ data: { publishClassQuiz: { __typename: 'ClassQuizPayload', quiz: quiz([]), userErrors: [] } } }),
  })
  await inApollo(<QuizBuilderScreen classroomId={CLASS} />)
  await fireEvent.press(screen.getByRole('button', { name: 'Choose a note' }))
  // Only notes on the server: AI reads them there.
  expect(await screen.findByRole('button', { name: 'Make questions from Respiration notes' })).toBeOnTheScreen()
  expect(screen.queryByRole('button', { name: 'Make questions from Not synced yet' })).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: 'Make questions from Respiration notes' }))
  await waitFor(() => expect(screen.getByLabelText('Words of question 2')).toBeOnTheScreen(), { timeout: 6000 })
  expect(screen.getByLabelText('Title').props.value).toBe('Respiration notes')
  await fireEvent.press(screen.getByRole('button', { name: 'Remove question 2' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Add a question' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Publish 2 questions' }))
  expect(await screen.findByText('Question 2 has no words.')).toBeOnTheScreen()
  await fireEvent.changeText(screen.getByLabelText('Words of question 2'), 'Which are products of respiration?')
  await fireEvent.changeText(screen.getAllByLabelText('Choice 1')[1]!, 'Water')
  await fireEvent.changeText(screen.getAllByLabelText('Choice 2')[1]!, 'Oxygen')
  await fireEvent.press(screen.getByRole('button', { name: 'Publish 2 questions' }))
  await waitFor(() => expect(router.back).toHaveBeenCalled())
  const input = api.calls.find((c) => c.op === 'PublishClassQuiz')!.variables.input as { title: string; sourceNoteId: string; questions: { question: unknown; correct: string[] }[] }
  expect(input).toMatchObject({ classroomId: CLASS, title: 'Respiration notes', sourceNoteId: NOTE })
  expect(input.questions.map((q) => [q.question, q.correct])).toEqual([
    [doc('What makes ATP?'), ['c1']],
    [doc('Which are products of respiration?'), ['c1']],
  ])
}, 15_000)
