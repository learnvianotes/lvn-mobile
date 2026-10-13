import { ApolloProvider } from '@apollo/client/react'
import { render, screen } from '@testing-library/react-native'
import { renderInApp } from '../../support/render'
import { ContinueCard } from '@/features/home/ContinueCard'
import { ExamReadiness } from '@/features/home/ExamReadiness'
import { HeroCard } from '@/features/home/HeroCard'
import { HomeHeader } from '@/features/home/HomeHeader'
import { QuickActions } from '@/features/home/QuickActions'
import { Recommended } from '@/features/home/Recommended'
import { createApolloClient } from '@/lib/apollo'
import { mockApi } from '../../support/api'

// The bell asks for the unread count (lvn-backend ADR-0042); no live socket in tests.
jest.mock('@/features/notifications/live', () => ({ useLive: jest.fn() }))

describe('HeroCard', () => {
  it('greets the learner by first name', async () => {
    await render(<HeroCard firstName="Asha" />)
    expect(screen.getByText('Keep learning, Asha')).toBeOnTheScreen()
    expect(screen.getByRole('header', { name: 'Make it happen' })).toBeOnTheScreen()
  })
})

describe('HomeHeader', () => {
  it('has the wordmark, notifications and search', async () => {
    mockApi({ UnreadNotificationCount: () => ({ data: { unreadNotificationCount: 2 } }) })
    await render(
      <ApolloProvider client={createApolloClient()}>
        <HomeHeader />
      </ApolloProvider>,
    )
    expect(screen.getByLabelText('LearnViaNotes')).toBeOnTheScreen()
    expect(await screen.findByRole('button', { name: 'Notifications, 2 unread' })).toBeOnTheScreen()
    expect(screen.getByLabelText('Search notes, topics and people')).toBeOnTheScreen()
  })
})

describe('QuickActions', () => {
  it('offers the five capture actions as buttons', async () => {
    await render(<QuickActions />)
    for (const label of ['Notes', 'Q&A', 'Camera', 'Voice', 'Upload']) {
      expect(screen.getByRole('button', { name: label })).toBeOnTheScreen()
    }
  })
})

const rec = (over: Record<string, unknown>) => ({ __typename: 'Recommendation', score: 50, noteTitle: null, topicKey: null, topicTitle: null, note: null, topic: null, kind: 'CONTINUE_NOTE' as const, reason: '', ...over }) as never
const EXAM = '01920000-0000-7000-8000-0000000e0001'
const exam = (over: Record<string, unknown> = {}) => ({ __typename: 'Exam', id: EXAM, name: 'Operating Systems', date: '2026-10-25', daysLeft: 12, past: false, readiness: 34, target: 80, targetToday: 40, topics: [{ __typename: 'ExamTopic', key: 'topic:a', title: 'Paging', recall: null, accuracy: 0.2, mastery: 0.08 }], tasks: [], ...over })

describe('ExamReadiness', () => {
  it('shows the next exam, days left, readiness and today\'s target', async () => {
    mockApi({ Exams: () => ({ data: { exams: [exam({ id: '01920000-0000-7000-8000-0000000e0000', name: 'Gone', past: true }), exam()] } }) })
    await renderInApp(<ApolloProvider client={createApolloClient()}><ExamReadiness /></ApolloProvider>)
    expect(await screen.findByText('Operating Systems')).toBeOnTheScreen()
    expect(screen.getByText('Upcoming exam · in 12 days')).toBeOnTheScreen()
    expect(screen.getByText('34%')).toBeOnTheScreen()
    expect(screen.getByText('Target for today: 40% · 1 topic to strengthen')).toBeOnTheScreen()
  })

  it('offers to add an exam when there is none', async () => {
    mockApi({ Exams: () => ({ data: { exams: [] } }) })
    await renderInApp(<ApolloProvider client={createApolloClient()}><ExamReadiness /></ApolloProvider>)
    expect(await screen.findByText('Add an exam')).toBeOnTheScreen()
  })
})

describe('ContinueCard', () => {
  it('resumes the note being read, saying when', async () => {
    await render(<ContinueCard item={rec({ noteTitle: 'Dijkstra', note: { __typename: 'Note', id: 'n1' }, reason: 'You were reading this on Monday, 12 October' })} />)
    expect(screen.getByRole('button', { name: 'Continue Dijkstra. You were reading this on Monday, 12 October' })).toBeOnTheScreen()
  })
})

describe('Recommended', () => {
  it('always says why each item is recommended', async () => {
    const items = [rec({ kind: 'EXAM_TOPIC', topicTitle: 'Paging', topicKey: 'topic:a', reason: 'On your plan for Operating Systems, in 5 days' }), rec({ kind: 'POPULAR_NOTE', noteTitle: 'Graphs', note: { __typename: 'Note', id: 'n2' }, reason: 'Popular in Graphs' })]
    await render(<Recommended items={items} />)
    expect(screen.getByRole('button', { name: 'Paging. On your plan for Operating Systems, in 5 days' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Graphs. Popular in Graphs' })).toBeOnTheScreen()
  })

  it('says how suggestions come when there are none', async () => {
    await render(<Recommended items={[]} />)
    expect(screen.getByText(/suggestions appear here/)).toBeOnTheScreen()
  })
})
