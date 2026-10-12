import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { Alert } from 'react-native'
import { Discussion } from '@/features/discussion/Discussion'
import { PostComments } from '@/features/discussion/PostComments'
import { createApolloClient } from '@/lib/apollo'
import { mockApi } from '../../support/api'
import { renderInApp } from '../../support/render'

/** Discussions on the phone (lvn-backend ADR-0047): reacting, commenting, replying, approving, removing, private class threads. */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }))

const NOTE = '01920000-0000-7000-8000-00000000a001'
const ravi = { __typename: 'User', id: 'u2', displayName: 'Ravi Kumar', handle: 'ravi' }
const doc = (s: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] })
const reactions = (helpful = 0, viewerReaction: string | null = null) => ({ __typename: 'Reactions', viewerReaction, counts: ['LIKE', 'HELPFUL', 'CELEBRATE'].map((kind) => ({ __typename: 'ReactionCount', kind, count: kind === 'HELPFUL' ? helpful : 0, atLeast: false })) })
const can = (over: Record<string, boolean> = {}) => ({ __typename: 'CommentActions', reply: true, edit: false, delete: false, approve: false, ...over })
type MockComment = Record<string, unknown> & { id: string; replies: MockComment[] }
const comment = (id: string, text: string, over: Record<string, unknown> = {}): MockComment => ({ __typename: 'Comment', moderation: 'OK', moderationReason: null, moderationCanAppeal: false, id, body: doc(text), cardId: null, removed: false, pendingApproval: false, private: false, createdAt: new Date().toISOString(), editedAt: null, author: ravi, reactions: reactions(), viewerCan: can(), replies: [], ...over })
const discussion = (list: MockComment[], over: Record<string, unknown> = {}) => ({
  data: { discussion: { __typename: 'Discussion', commentCount: list.length, viewerCanComment: true, whyNot: null, reactions: reactions(), comments: { __typename: 'CommentConnection', edges: list.map((node) => ({ __typename: 'CommentEdge', node })), pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: null } }, ...over } },
})
const inApollo = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)
const target = { type: 'NOTE' as const, id: NOTE }

beforeEach(() => jest.clearAllMocks())

it('a reader reacts, comments and replies to a comment', async () => {
  let list = [comment('c1', 'Why halve it?')]
  let mine: string | null = null
  const api = mockApi({
    Discussion: () => {
      const d = discussion(list)
      d.data.discussion.reactions = reactions(mine ? 1 : 0, mine)
      return d
    },
    React: (v) => ((mine = (v.kind as string | null) ?? null), { data: { react: { __typename: 'ReactPayload', reactions: reactions(1, mine), userErrors: [] } } }),
    AddComment: (v) => {
      const input = v.input as { parentId?: string; body: ReturnType<typeof doc> }
      const made = comment(`c${Math.random()}`, input.body.content[0]!.content[0]!.text, { viewerCan: can({ reply: !input.parentId }) })
      list = input.parentId ? list.map((c) => (c.id === input.parentId ? { ...c, replies: [...c.replies, made] } : c)) : [...list, made]
      return { data: { addComment: { __typename: 'CommentPayload', comment: { __typename: 'Comment', id: made.id }, userErrors: [] } } }
    },
  })
  await inApollo(<Discussion target={target} />)
  expect(await screen.findByText('Why halve it?')).toBeOnTheScreen()
  await fireEvent.press(screen.getAllByLabelText('Helpful')[0]!)
  await waitFor(() => expect(api.calls.find((c) => c.op === 'React')?.variables).toEqual({ target, kind: 'HELPFUL' }))

  await fireEvent.changeText(screen.getByLabelText('Write a comment'), 'Each step drops half')
  await fireEvent.press(screen.getByText('Comment'))
  expect(await screen.findByText('Each step drops half')).toBeOnTheScreen()
  expect(api.calls.find((c) => c.op === 'AddComment')?.variables).toEqual({ input: { target, body: doc('Each step drops half') } })

  await fireEvent.press(screen.getAllByText('Reply')[0]!)
  expect(screen.getByText('Replying to Ravi Kumar')).toBeOnTheScreen()
  await fireEvent.changeText(screen.getByLabelText('Write a reply'), 'So log n steps')
  await fireEvent.press(screen.getAllByText('Reply').at(-1)!)
  expect(await screen.findByText('So log n steps')).toBeOnTheScreen()
  expect(api.calls.filter((c) => c.op === 'AddComment')[1]?.variables).toEqual({ input: { target, parentId: 'c1', body: doc('So log n steps') } })
})

it('the owner approves a waiting comment and removes another after confirming', async () => {
  let list = [comment('c1', 'Pick me', { pendingApproval: true, viewerCan: can({ approve: true, delete: true }) }), comment('c2', 'Spam here', { viewerCan: can({ delete: true }) })]
  jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => buttons?.find((b) => b.style === 'destructive')?.onPress?.())
  const api = mockApi({
    Discussion: () => discussion(list),
    ApproveComment: () => ((list = list.map((c) => (c.id === 'c1' ? { ...c, pendingApproval: false } : c))), { data: { approveComment: { __typename: 'CommentPayload', comment: { __typename: 'Comment', id: 'c1' }, userErrors: [] } } }),
    DeleteComment: () => ((list = list.filter((c) => c.id !== 'c2')), { data: { deleteComment: { __typename: 'CommentPayload', comment: { __typename: 'Comment', id: 'c2' }, userErrors: [] } } }),
  })
  await inApollo(<Discussion target={target} />)
  expect(await screen.findByText('Waiting for approval')).toBeOnTheScreen()
  await fireEvent.press(screen.getByText('Approve'))
  await waitFor(() => expect(screen.queryByText('Waiting for approval')).toBeNull())
  await fireEvent.press(screen.getAllByLabelText('Delete comment').at(-1)!)
  await waitFor(() => expect(screen.queryByText('Spam here')).toBeNull())
  expect(api.calls.find((c) => c.op === 'DeleteComment')?.variables).toEqual({ commentId: 'c2' })
})

it('someone who may not comment is told why', async () => {
  mockApi({ Discussion: () => discussion([comment('c1', 'x', { removed: true, author: null, body: null })], { viewerCanComment: false, whyNot: 'Verify your account to comment.' }) })
  await inApollo(<Discussion target={target} />)
  expect(await screen.findByText('Verify your account to comment.')).toBeOnTheScreen()
  expect(screen.getByText('This comment was removed.')).toBeOnTheScreen()
  expect(screen.queryByLabelText('Write a comment')).toBeNull()
})

it('a class announcement opens a private thread with the staff', async () => {
  const api = mockApi({ Discussion: () => discussion([comment('c1', 'Which chapters?', { private: true })]) })
  await inApollo(<PostComments type="CLASSROOM_POST" id="p1" count={1} />)
  await fireEvent.press(screen.getByText('1 comment'))
  expect(await screen.findByText('Private thread')).toBeOnTheScreen()
  expect(screen.getByLabelText('Write a comment').props.placeholder).toBe("Ask the teacher a question. Only you and the class's staff see it.")
  expect(api.calls.find((c) => c.op === 'Discussion')?.variables).toEqual({ target: { type: 'CLASSROOM_POST', id: 'p1' } })
})
