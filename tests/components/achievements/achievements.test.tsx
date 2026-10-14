import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen } from '@testing-library/react-native'
import { router } from 'expo-router'
import { AchievementsScreen } from '@/features/achievements/AchievementsScreen'
import { createApolloClient } from '@/lib/apollo'
import { mockApi } from '../../support/api'
import { renderInApp } from '../../support/render'

/**
 * Achievements on the phone (lvn-backend ADR-0080): the level and the way to the next, the badges, the points history
 * opening what earned each line, and showing them on the profile for an adult; a minor reads they stay private.
 */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true } }))

const ME = '01920000-0000-7000-8000-00000000aaaa'
const NOTE = '01920000-0000-7000-8000-00000000c0c1'
const inApp = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)
const mine = (canShow: boolean, shown = false, achievements = [{ __typename: 'Achievement', id: '01920000-0000-7000-8000-0000000000a1', kind: 'QUIZ_MASTER', tier: 1, title: 'Quiz master', description: 'Nine in ten right', subjectTitle: null, earnedAt: new Date().toISOString() }]) => ({
  data: {
    viewer: { __typename: 'User', id: ME, achievements, contribution: { __typename: 'Contribution', points: 30, level: 'NEWCOMER', nextLevelAt: 50 } },
    achievementSettings: { __typename: 'AchievementSettings', showAchievements: shown, canShow },
  },
})
const history = (edges: { delta: number; rule: string; sourceType: string; sourceId: string }[]) => ({
  data: {
    myPoints: {
      __typename: 'PointsEntryConnection',
      edges: edges.map((e, i) => ({ __typename: 'PointsEntryEdge', cursor: String(i), node: { __typename: 'PointsEntry', id: `01920000-0000-7000-8000-0000000000e${i}`, subjectTitle: null, createdAt: new Date().toISOString(), ...e } })),
      pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: null },
    },
  },
})

beforeEach(() => jest.clearAllMocks())

it('shows the level, the badges and the points; a line opens its note; an adult shows them on the profile', async () => {
  let shown = false
  const api = mockApi({
    MyAchievements: () => mine(true, shown),
    MyPoints: () => history([{ delta: 1, rule: 'REACTION', sourceType: 'NOTE', sourceId: NOTE }]),
    SetAchievementsShown: (v) => ((shown = v.show as boolean), { data: { setAchievementsShown: { __typename: 'AchievementSettingsPayload', settings: { __typename: 'AchievementSettings', showAchievements: shown, canShow: true }, userErrors: [] } } }),
  })
  await inApp(<AchievementsScreen />)
  expect(await screen.findByText('Newcomer')).toBeOnTheScreen()
  expect(screen.getByText('20 more points to the next level')).toBeOnTheScreen()
  expect(screen.getByLabelText('Quiz master. Nine in ten right')).toBeOnTheScreen()
  await fireEvent.press(await screen.findByRole('link', { name: /A reaction on your note/ }))
  expect(router.push).toHaveBeenLastCalledWith(`/notes/${NOTE}`)
  await fireEvent(screen.getByLabelText('Show my achievements and level on my profile'), 'valueChange', true)
  expect(api.calls.find((c) => c.op === 'SetAchievementsShown')?.variables).toEqual({ show: true })
})

it('a minor reads that their achievements stay private; with none yet, the screen says how to earn them', async () => {
  mockApi({ MyAchievements: () => mine(false, false, []), MyPoints: () => history([]) })
  await inApp(<AchievementsScreen />)
  expect(await screen.findByText('Your achievements stay private until you are 18: only you see them.')).toBeOnTheScreen()
  expect(screen.queryByLabelText('Show my achievements and level on my profile')).toBeNull()
  await fireEvent.press(screen.getByRole('link', { name: 'Review cards' }))
  expect(router.push).toHaveBeenLastCalledWith('/review')
})
