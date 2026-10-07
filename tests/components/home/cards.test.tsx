import { render, screen } from '@testing-library/react-native'
import { ContinueCard } from '@/features/home/ContinueCard'
import { ExamReadiness } from '@/features/home/ExamReadiness'
import { HeroCard } from '@/features/home/HeroCard'
import { HomeHeader } from '@/features/home/HomeHeader'
import { QuickActions } from '@/features/home/QuickActions'
import { Recommended } from '@/features/home/Recommended'
import { continueLearning, exam, recommended } from '@/features/home/mock'

describe('HeroCard', () => {
  it('greets the learner by first name', async () => {
    await render(<HeroCard firstName="Asha" />)
    expect(screen.getByText('Keep learning, Asha')).toBeOnTheScreen()
    expect(screen.getByRole('header', { name: 'Make it happen' })).toBeOnTheScreen()
  })
})

describe('HomeHeader', () => {
  it('has the wordmark, notifications and search', async () => {
    await render(<HomeHeader />)
    expect(screen.getByLabelText('LearnViaNotes')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Notifications, 2 new' })).toBeOnTheScreen()
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

describe('ExamReadiness', () => {
  it('shows the exam, days left, readiness and today\'s target', async () => {
    await render(<ExamReadiness />)
    expect(screen.getByText(exam.subject)).toBeOnTheScreen()
    expect(screen.getByText(`Upcoming exam · in ${exam.daysLeft} days`)).toBeOnTheScreen()
    expect(screen.getByText(`${Math.round(exam.readiness * 100)}%`)).toBeOnTheScreen()
    expect(screen.getByText(new RegExp(`Target for today: ${Math.round(exam.target * 100)}%`))).toBeOnTheScreen()
  })
})

describe('ContinueCard', () => {
  it('resumes the last topic and announces progress', async () => {
    await render(<ContinueCard />)
    const pct = Math.round(continueLearning.progress * 100)
    expect(screen.getByRole('button', { name: `Continue ${continueLearning.topic}, ${pct} percent complete` })).toBeOnTheScreen()
    expect(screen.getByText(`${pct}% complete`)).toBeOnTheScreen()
  })
})

describe('Recommended', () => {
  it('always says why each item is recommended', async () => {
    await render(<Recommended />)
    for (const r of recommended) {
      expect(screen.getByRole('button', { name: `${r.title}, ${r.subject}. ${r.reason}` })).toBeOnTheScreen()
      expect(screen.getByText(r.reason)).toBeOnTheScreen()
    }
  })
})
