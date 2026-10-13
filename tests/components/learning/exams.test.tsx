import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { ExamScreen, ExamsScreen } from '@/features/learning/ExamsScreen'
import { createApolloClient } from '@/lib/apollo'
import { mockApi } from '../../support/api'
import { renderInApp } from '../../support/render'

/**
 * Exams on the phone (lvn-backend ADR-0070): Readiness against today's target and today's revision; adding an exam
 * with topics found by name; one exam's topics and plan; weak topics with why.
 */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }))

const EXAM = '01920000-0000-7000-8000-0000000e0001'
const TOPIC_A = '01920000-0000-7000-8000-0000000070a1'
const TOPIC_B = '01920000-0000-7000-8000-0000000070b2'
const topic = (id: string, title: string, over: Record<string, unknown> = {}) => ({ __typename: 'ExamTopic', key: `topic:${id}`, title, recall: null, accuracy: null, mastery: 0, ...over })
const task = (n: number, day: string, titles: string[], over: Record<string, unknown> = {}) => ({ __typename: 'ExamPlanTask', id: `01920000-0000-7000-8000-00000000aa0${n}`, day, done: false, today: false, topics: titles.map((title) => ({ __typename: 'ExamPlanTopic', key: `topic:${title}`, title })), ...over })
const exam = (over: Record<string, unknown> = {}) => ({
  __typename: 'Exam',
  id: EXAM,
  name: 'Operating Systems',
  date: '2026-10-25',
  daysLeft: 12,
  past: false,
  readiness: 34,
  target: 80,
  targetToday: 40,
  topics: [topic(TOPIC_A, 'Paging', { recall: 0.9, accuracy: 0.2, mastery: 0.62 }), topic(TOPIC_B, 'Scheduling')],
  tasks: [task(1, '2026-10-12', ['Paging'], { done: true }), task(2, '2026-10-13', ['Scheduling'], { today: true }), task(3, '2099-10-24', ['Paging'])],
  ...over,
})
const weakTopics = [{ __typename: 'WeakTopic', key: `topic:${TOPIC_A}`, title: 'Paging', reason: 'LOW_ACCURACY', accuracy: 0.2, examId: EXAM, examName: 'Operating Systems', daysLeft: 12 }]
const inApp = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)

it('lists exams with Readiness against today’s target, today’s revision, and weak topics', async () => {
  mockApi({ Exams: () => ({ data: { exams: [exam()] } }), WeakTopics: () => ({ data: { weakTopics } }) })
  await inApp(<ExamsScreen />)
  expect(await screen.findByText('Readiness 34%')).toBeOnTheScreen()
  expect(screen.getByLabelText('Readiness: 34%, target today 40%')).toBeOnTheScreen()
  expect(screen.getByText('6 points below today’s target')).toBeOnTheScreen()
  expect(screen.getByText('Today: Scheduling')).toBeOnTheScreen()
  expect(screen.getByText('In 12 days')).toBeOnTheScreen()
  expect(await screen.findByText('Under 60% right in your last quizzes (20%)')).toBeOnTheScreen()
})

it('adds an exam with topics found by name, and says why one cannot be added', async () => {
  let refuse = true
  const api = mockApi({
    Exams: () => ({ data: { exams: [] } }),
    WeakTopics: () => ({ data: { weakTopics: [] } }),
    ExamTopicOptions: () => ({ data: { examTopicOptions: [{ __typename: 'ExamTopicOption', id: TOPIC_A, key: `topic:${TOPIC_A}`, title: 'Paging', subjectTitle: 'Operating Systems' }] } }),
    CreateExam: () => {
      if (refuse) {
        refuse = false
        return { data: { createExam: { __typename: 'ExamPayload', exam: null, userErrors: [{ __typename: 'UserError', message: 'You can plan for 10 exams at a time.', code: 'VALIDATION' }] } } }
      }
      return { data: { createExam: { __typename: 'ExamPayload', exam: exam(), userErrors: [] } } }
    },
  })
  await inApp(<ExamsScreen />)
  await fireEvent.press(await screen.findByRole('button', { name: 'Add an exam' }))
  await fireEvent.changeText(screen.getByLabelText('Exam'), 'Operating Systems')
  await fireEvent.press(screen.getByRole('button', { name: 'A week later' }))
  await fireEvent.changeText(screen.getByLabelText('Find a topic'), 'pag')
  await fireEvent.press(await screen.findByRole('button', { name: 'Add Paging' }, { timeout: 2000 }))
  await fireEvent.press(screen.getByRole('button', { name: 'Add the exam' }))
  expect(await screen.findByText('You can plan for 10 exams at a time.')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Add the exam' }))
  await waitFor(() => expect(api.calls.filter((c) => c.op === 'CreateExam')).toHaveLength(2))
  const input = api.calls.filter((c) => c.op === 'CreateExam').at(-1)!.variables.input as { name: string; date: string; topicIds: string[] }
  expect(input).toMatchObject({ name: 'Operating Systems', topicIds: [TOPIC_A] })
  expect(input.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
})

it('shows one exam’s topics and plan', async () => {
  mockApi({ Exam: () => ({ data: { exam: exam() } }) })
  await inApp(<ExamScreen id={EXAM} />)
  expect(await screen.findByText('Recall 90% · Accuracy 20%')).toBeOnTheScreen()
  expect(screen.getByText('No flashcards or quizzes yet')).toBeOnTheScreen()
  expect(screen.getByLabelText(/Paging, done$/)).toBeOnTheScreen()
  expect(screen.getByLabelText(/Scheduling, today$/)).toBeOnTheScreen()
  expect(screen.getByLabelText(/Paging, to come$/)).toBeOnTheScreen()
})
