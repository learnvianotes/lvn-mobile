import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import { Linking } from 'react-native'
import { GroupScreen } from '@/features/groups/GroupScreen'
import { DoubtScreen } from '@/features/workspaces/DoubtScreen'
import { createApolloClient } from '@/lib/apollo'
import { mockApi } from '../../support/api'
import { renderInApp } from '../../support/render'

/** Project workspaces on the phone (lvn-backend ADR-0048): repository card, ideas, doubts, a mentor invite. */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }))
jest.mock('@/features/notes/store/db', () => ({ listNotes: jest.fn(async () => []), subscribe: () => () => {} }))

const GROUP = '01920000-0000-7000-8000-0000000a0009'
const DOUBT = '01920000-0000-7000-8000-0000000d0001'
const meera = { __typename: 'User', id: 'u2', displayName: 'Meera Iyer', handle: 'meera' }
const asha = { __typename: 'User', id: 'u1', displayName: 'Asha Rao', handle: 'asha' }
const doc = (s: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] })
const can = (over: Record<string, boolean> = {}) => ({ __typename: 'GroupActions', join: false, requestJoin: false, post: true, moderate: false, manage: false, delete: false, reviewRequests: false, leave: true, askDoubt: true, inviteMentor: false, acceptMentorInvite: false, ...over })
const workspace = (over: Record<string, unknown> = {}) => ({ __typename: 'Group', moderationWarning: null, id: GROUP, type: 'PROJECT', name: 'Heap visualiser', description: null, privacy: 'PUBLIC', joinPolicy: 'OPEN', memberCount: 4, viewerRole: 'MEMBER', createdAt: '2026-10-01T10:00:00.000Z', viewerRequestId: null, viewerMentorInviteId: null, owner: { __typename: 'User', id: 'u2', displayName: 'Meera Iyer' }, viewerCan: can(), ...over })
const posts = () => ({ data: { group: { __typename: 'Group', id: GROUP, posts: { __typename: 'GroupPostConnection', pinned: [], edges: [], pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: null } } } } })
const repository = { __typename: 'GroupRepository', provider: 'GITHUB', url: 'https://github.com/team/heap-viz', available: true, name: 'team/heap-viz', description: 'Watch a heap grow', language: 'TypeScript', stars: 42, pushedAt: '2026-10-10T09:00:00.000Z' }
const idea = (id: string, text: string) => ({ __typename: 'GroupPost', moderation: 'OK', moderationReason: null, moderationCanAppeal: false, id, kind: 'IDEA', body: doc(text), pinned: false, createdAt: new Date().toISOString(), editedAt: null, author: meera, viewerCan: { __typename: 'GroupPostActions', edit: false, delete: false, pin: false }, discussion: { __typename: 'Discussion', commentCount: 0 } })
const inApollo = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)

beforeEach(() => jest.clearAllMocks())

it('a workspace shows its repository, ideas ranked, and opens a doubt it asked', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
  const api = mockApi({
    Group: () => ({ data: { group: workspace() } }),
    GroupPosts: posts,
    Workspace: () => ({ data: { group: { __typename: 'Group', id: GROUP, repository, showcase: null } } }),
    WorkspaceIdeas: () => ({ data: { group: { __typename: 'Group', id: GROUP, ideas: [idea('i1', 'Animate sift-down'), idea('i2', 'Dark mode')] } } }),
    WorkspaceDoubts: () => ({ data: { group: { __typename: 'Group', id: GROUP, doubts: { __typename: 'DoubtConnection', edges: [], pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: null } } } } }),
    AskDoubt: () => ({ data: { askDoubt: { __typename: 'DoubtPayload', doubt: { __typename: 'Doubt', id: DOUBT }, userErrors: [] } } }),
  })
  await inApollo(<GroupScreen id={GROUP} />)
  expect(await screen.findByText('Watch a heap grow')).toBeOnTheScreen()
  expect(screen.getByText('42 stars')).toBeOnTheScreen()
  await fireEvent.press(screen.getByLabelText('Repository team/heap-viz'))
  expect(open).toHaveBeenCalledWith('https://github.com/team/heap-viz')

  await fireEvent.press(screen.getByText('Ideas'))
  expect(await screen.findByText('Animate sift-down')).toBeOnTheScreen()
  expect(screen.getByLabelText('Rank 1')).toBeOnTheScreen()

  await fireEvent.press(screen.getByText('Doubts'))
  await fireEvent.press(await screen.findByText('Ask a doubt'))
  await fireEvent.changeText(screen.getByLabelText('Your question'), 'Why swap twice?')
  await fireEvent.changeText(screen.getByLabelText('Details'), 'See the loop')
  await fireEvent.press(screen.getByText('Ask'))
  await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/groups/${GROUP}/doubts/${DOUBT}`))
  expect(api.calls.find((c) => c.op === 'AskDoubt')?.variables).toEqual({ input: { groupId: GROUP, title: 'Why swap twice?', body: doc('See the loop'), repoRef: null } })
})

it('a teacher answers an invite to mentor from the workspace', async () => {
  let invited = true
  const api = mockApi({
    Group: () => ({ data: { group: workspace(invited ? { viewerRole: null, viewerMentorInviteId: 'mi1', viewerCan: can({ post: false, leave: false, askDoubt: false, acceptMentorInvite: true }) } : { viewerRole: 'MENTOR' }) } }),
    GroupPosts: posts,
    Workspace: () => ({ data: { group: { __typename: 'Group', id: GROUP, repository: null, showcase: null } } }),
    AnswerMentorInvite: () => ((invited = false), { data: { answerMentorInvite: { __typename: 'GroupPayload', group: workspace({ viewerRole: 'MENTOR' }), userErrors: [] } } }),
  })
  await inApollo(<GroupScreen id={GROUP} />)
  expect(await screen.findByText("You've been asked to mentor this project.")).toBeOnTheScreen()
  await fireEvent.press(screen.getByText('Accept'))
  await waitFor(() => expect(api.calls.find((c) => c.op === 'AnswerMentorInvite')?.variables).toEqual({ inviteId: 'mi1', accept: true }))
})

it('a doubt shows the mentor’s answer, takes another, and resolves', async () => {
  let status = 'ANSWERED'
  let answers = [{ __typename: 'DoubtAnswer', id: 'a1', body: doc('It swaps the larger child'), byMentor: true, createdAt: new Date().toISOString(), author: meera }]
  const detail = () => ({ data: { doubt: { __typename: 'Doubt', moderation: 'OK', moderationReason: null, moderationCanAppeal: false, id: DOUBT, title: 'Why swap twice?', status, repoRef: 'src/heap.ts:42', createdAt: new Date().toISOString(), answerCount: answers.length, author: asha, body: doc('See the loop'), resolvedAt: null, viewerCan: { __typename: 'DoubtActions', answer: status !== 'RESOLVED', resolve: status !== 'RESOLVED', reopen: status === 'RESOLVED', delete: true }, answers } } })
  const api = mockApi({
    Doubt: detail,
    AnswerDoubt: () => ((answers = [...answers, { __typename: 'DoubtAnswer', id: 'a2', body: doc('Thanks, got it'), byMentor: false, createdAt: new Date().toISOString(), author: asha }]), { data: { answerDoubt: { __typename: 'DoubtPayload', ...detail().data, userErrors: [] } } }),
    ResolveDoubt: () => ((status = 'RESOLVED'), { data: { resolveDoubt: { __typename: 'DoubtPayload', ...detail().data, userErrors: [] } } }),
  })
  await inApollo(<DoubtScreen id={DOUBT} />)
  expect(await screen.findByText('It swaps the larger child')).toBeOnTheScreen()
  expect(screen.getByText('Mentor')).toBeOnTheScreen()
  expect(screen.getByText('src/heap.ts:42')).toBeOnTheScreen()
  await fireEvent.changeText(screen.getByLabelText('Your answer'), 'Thanks, got it')
  await fireEvent.press(screen.getByText('Answer'))
  expect(await screen.findByText('Thanks, got it')).toBeOnTheScreen()
  await fireEvent.press(screen.getByText('Mark resolved'))
  expect(await screen.findByText('This doubt is resolved. Reopen it to answer again.')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'ResolveDoubt')?.variables).toEqual({ doubtId: DOUBT })
})
