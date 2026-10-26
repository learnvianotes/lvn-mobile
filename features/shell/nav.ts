import type { Href } from 'expo-router'

/** The signed-in destinations, in the same order as the web sidebar. Paths are this app's routes. */
export const APP_NAV: { label: string; href: Href }[] = [
  { label: 'Home', href: '/' },
  { label: 'My Notes', href: '/notes' },
  { label: 'Explore', href: '/explore' },
  { label: 'Subjects', href: '/subjects' },
  { label: 'Groups', href: { pathname: '/community', params: { section: 'places' } } },
  { label: 'Classrooms', href: { pathname: '/community', params: { section: 'places' } } },
  { label: 'Exams', href: '/exams' },
  { label: 'Quizzes', href: '/review' },
  { label: 'Contests', href: '/contests' },
  { label: 'Rhythm', href: '/rhythm' },
  { label: 'Resources', href: '/resources' },
  { label: 'Community', href: '/community' },
  { label: 'AI Assistant', href: '/ask' },
  { label: 'Bookmarks', href: '/saved' },
]
