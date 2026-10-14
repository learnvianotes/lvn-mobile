import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen } from '@testing-library/react-native'
import { ClassRhythm } from '@/features/classes/ClassInsights'
import { WeeklyTasks } from '@/features/learning/WeeklyTasks'
import { createApolloClient } from '@/lib/apollo'
import { mockApi } from '../../support/api'
import { renderInApp } from '../../support/render'

/**
 * Weekly tasks and the class goal on the phone (lvn-backend ADR-0081): tasks with their progress and plan, one added
 * from a suggestion; a class goal's total for a student, and each part and the target for its teacher.
 */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true } }))

const TOPIC = '01920000-0000-7000-8000-00000000c511'
const CLASS = '01920000-0000-7000-8000-0000000c1a55'
const inApp = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)
const task = (id: string, kind: string, target: number, progress: number, extra: Record<string, unknown> = {}) => ({ __typename: 'WeeklyTask', id, kind, target, progress, done: progress >= target, topicId: null, topicTitle: null, plan: null, ...extra })

it('shows the week’s tasks and adds one from a suggestion', async () => {
  let tasks = [task('01920000-0000-7000-8000-0000000007a1', 'REVIEWS', 10, 12, { plan: 'After lunch' })]
  const api = mockApi({
    WeeklyTasks: () => ({ data: { weeklyTasks: { __typename: 'WeeklyTasks', weekStart: '2026-10-12', max: 3, tasks } } }),
    TaskSuggestions: () => ({ data: { taskSuggestions: [{ __typename: 'TaskSuggestion', kind: 'TOPIC_MINUTES', target: 60, topicId: TOPIC, topicTitle: 'Heaps', why: 'Midterm is in 10 days, and Heaps is its weakest topic.' }] } }),
    AddWeeklyTask: () => {
      tasks = [...tasks, task('01920000-0000-7000-8000-0000000007a2', 'TOPIC_MINUTES', 60, 0, { topicId: TOPIC, topicTitle: 'Heaps' })]
      return { data: { addWeeklyTask: { __typename: 'WeeklyTaskPayload', task: tasks.at(-1), userErrors: [] } } }
    },
  })
  await inApp(<WeeklyTasks />)
  expect(await screen.findByText('1 of 1 done')).toBeOnTheScreen()
  expect(screen.getByText('Plan: After lunch')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Add a task' }))
  expect(await screen.findByText('Midterm is in 10 days, and Heaps is its weakest topic.')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Add the task Spend 60 minutes on Heaps' }))
  expect(await screen.findByText('1 of 2 done')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'AddWeeklyTask')?.variables).toEqual({ input: { kind: 'TOPIC_MINUTES', target: 60, topicId: TOPIC, plan: null } })
})

const ring = (parts: unknown) => ({
  data: { classroom: { __typename: 'Classroom', id: CLASS, rhythmRing: { __typename: 'ClassroomRhythm', students: 2, metCount: 0, countedDays: 3, targetDays: 8, people: [], goal: { __typename: 'ClassGoal', target: 4, progress: 3, sharePerStudent: 3, automatic: false, reached: false, parts } } } },
})

it('a class goal shows a student the total, never the parts or the controls', async () => {
  mockApi({ ClassroomRhythmRing: () => ring(null) })
  await inApp(<ClassRhythm classroomId={CLASS} />)
  expect(await screen.findByText('3 of 4 counted days, together')).toBeOnTheScreen()
  expect(screen.queryByText('Each student’s part (only teachers see this)')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Update the goal' })).toBeNull()
})

it('a class goal shows its teacher each part, and sets the target', async () => {
  const api = mockApi({
    ClassroomRhythmRing: () => ring([{ __typename: 'ClassGoalPart', countedDays: 2, user: { __typename: 'User', id: '01920000-0000-7000-8000-0000000000dd', displayName: 'Kiran Das' } }]),
    SetClassGoal: () => ({ data: { setClassGoal: { __typename: 'OkPayload', ok: true, userErrors: [] } } }),
  })
  await inApp(<ClassRhythm classroomId={CLASS} staff />)
  expect(await screen.findByText('Kiran Das')).toBeOnTheScreen()
  await fireEvent.changeText(screen.getByLabelText('Target in counted days'), '6')
  await fireEvent.press(screen.getByRole('button', { name: 'Update the goal' }))
  expect(api.calls.find((c) => c.op === 'SetClassGoal')?.variables).toEqual({ input: { classroomId: CLASS, on: true, target: 6 } })
})
