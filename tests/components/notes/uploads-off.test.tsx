import { ApolloProvider } from '@apollo/client/react'
import { act, screen, waitFor } from '@testing-library/react-native'
import { CreateSheet } from '@/features/shell/CreateSheet'
import { VerifyCard } from '@/features/verification/Verification'
import { createApolloClient } from '@/lib/apollo'
import { mockApi, viewer } from '../../support/api'
import { renderInApp } from '../../support/render'

/**
 * The launch runs with uploads off (lvn-backend ADR-0097): Query.uploadsEnabled is false and nothing that would send a
 * file is offered, so no control fails when pressed.
 */
jest.mock('@/lib/haptics', () => ({ haptic: { tick: jest.fn(), press: jest.fn(), success: jest.fn() } }))
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))

const inApollo = (ui: React.ReactElement) => renderInApp(<ApolloProvider client={createApolloClient()}>{ui}</ApolloProvider>)
/** Until the API answers, the app counts uploads as off; wait for the answer so "off" is the API's, not the default. */
const answered = async (calls: ReturnType<typeof mockApi>) => {
  await waitFor(() => expect(calls.ops()).toContain('UploadsEnabled'))
  await act(async () => undefined)
}
const api = (uploadsEnabled: boolean) =>
  mockApi({
    UploadsEnabled: () => ({ data: { uploadsEnabled } }),
    Viewer: () => ({ data: { viewer: viewer() } }),
    MyVerificationRequests: () => ({ data: { myVerificationRequests: [] } }),
  })

it('the create sheet offers no voice note, photo or upload while uploads are off', async () => {
  const off = api(false)
  await inApollo(<CreateSheet open onClose={jest.fn()} />)
  await answered(off)
  expect(await screen.findByRole('button', { name: 'Note' })).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Quiz' })).toBeOnTheScreen()
  for (const label of ['Voice note', 'Photo', 'Upload']) expect(screen.queryByRole('button', { name: label })).toBeNull()

  api(true)
  await inApollo(<CreateSheet open onClose={jest.fn()} />)
  for (const label of ['Voice note', 'Photo', 'Upload']) expect(await screen.findByRole('button', { name: label })).toBeOnTheScreen()
})

it('verification offers asking a teacher only, and says so, while uploads are off', async () => {
  const off = api(false)
  await inApollo(<VerifyCard restrictedMinor={false} />)
  await answered(off)
  expect(await screen.findByRole('button', { name: 'Ask a teacher' })).toBeOnTheScreen()
  expect(screen.getByText('No college email? Ask a teacher who knows you to vouch for you.')).toBeOnTheScreen()
  expect(screen.queryByRole('button', { name: 'Send proof of study' })).toBeNull()

  api(true)
  await inApollo(<VerifyCard restrictedMinor={false} />)
  expect(await screen.findByRole('button', { name: 'Send proof of study' })).toBeOnTheScreen()
})
