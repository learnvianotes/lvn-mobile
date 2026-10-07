/**
 * PROTOTYPE DATA — prototype/home-screen branch only. Real data comes from the API in the phase that owns each part
 * (spec §18): Rhythm and Exam Readiness in Phase 6, recommendations in Phase 6, notes in Phase 2.
 */
export const learner = { firstName: 'Manideep' }

/** Monday-first week. target: a planned study day; counted: met the day bar (ADR-0030). */
export const week = [
  { label: 'M', target: true, counted: true },
  { label: 'T', target: false, counted: false },
  { label: 'W', target: true, counted: true },
  { label: 'T', target: true, counted: false, today: true },
  { label: 'F', target: false, counted: false },
  { label: 'S', target: true, counted: false },
  { label: 'S', target: false, counted: false },
] as const

export const today = {
  reviewsDone: 6,
  /** The day counts at 10 reviews (or 10 learning minutes); the ring's full mark is 20. */
  dayBar: 10,
  ringFull: 20,
  items: ['14 reviews due', 'OS plan · 1 task', 'Weak topic: Deadlocks'],
}

export const rhythm = { weeksThisTerm: 9 }

export const exam = { subject: 'Operating Systems', daysLeft: 12, readiness: 0.62, target: 0.7 }

export const continueLearning = { subject: 'Operating Systems', topic: 'Process Management', progress: 0.45 }

export const subjects = ['For you', 'DSA', 'Operating Systems', 'ML & AI', 'DBMS', 'Networks']

export const recommended = [
  { title: 'Graphs', subject: 'DSA', reason: 'Weak topic in your last quiz', tone: 'primary' as const, icon: 'graph' as const },
  { title: 'Machine Learning basics', subject: 'ML & AI', reason: 'Popular in CSE · 3rd year', tone: 'sky' as const, icon: 'brain' as const },
  { title: 'Computer Networks', subject: 'Core CS', reason: 'On your exam plan', tone: 'warm' as const, icon: 'network' as const },
]
