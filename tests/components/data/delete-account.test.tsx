import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { DeleteAccountCard, DeletionBanner } from '@/features/data/DeleteAccountCard'
import { createApolloClient } from '@/lib/apollo'
import { mockApi, viewer } from '../../support/api'
import { renderInApp } from '../../support/render'

/** Delete your account (lvn-backend ADR-0088): password and DELETE, then the date it goes, and Keep my account. */
it('asks for the password and DELETE, shows the date, and keeps the account from the banner', async () => {
  const due = '2026-10-28T10:00:00.000Z'
  let scheduled: string | null = null
  const api = mockApi({
    Viewer: () => ({ data: { viewer: viewer({ deletionScheduledFor: scheduled }) } }),
    RequestAccountDeletion: (v) => {
      const input = v.input as { password: string | null; confirm: string }
      if (input.password !== 'my passphrase') return { data: { requestAccountDeletion: { __typename: 'AccountDeletionPayload', deletionScheduledFor: null, userErrors: [{ __typename: 'UserError', field: ['input', 'password'], message: 'That password is not right.' }] } } }
      scheduled = due
      return { data: { requestAccountDeletion: { __typename: 'AccountDeletionPayload', deletionScheduledFor: due, userErrors: [] } } }
    },
    CancelAccountDeletion: () => {
      scheduled = null
      return { data: { cancelAccountDeletion: { __typename: 'AccountDeletionPayload', deletionScheduledFor: null, userErrors: [] } } }
    },
  })
  await renderInApp(
    <ApolloProvider client={createApolloClient()}>
      <DeleteAccountCard />
      <DeletionBanner />
    </ApolloProvider>,
  )
  const submit = await screen.findByText('Delete my account')
  await fireEvent.press(submit)
  expect(api.ops()).not.toContain('RequestAccountDeletion')

  await fireEvent.changeText(screen.getByTestId('delete-password'), 'wrong')
  await fireEvent.changeText(screen.getByTestId('delete-confirm'), 'delete')
  await fireEvent.press(screen.getByText('Delete my account'))
  await waitFor(() => expect(api.ops()).toContain('RequestAccountDeletion'))
  expect(await screen.findByText('That password is not right.')).toBeTruthy()

  await fireEvent.changeText(screen.getByTestId('delete-password'), 'my passphrase')
  await fireEvent.press(screen.getByText('Delete my account'))
  expect(await screen.findByText(/Every other device was signed out/)).toBeTruthy()
  expect(screen.getByTestId('deletion-banner')).toBeTruthy()
  expect(api.calls.filter((c) => c.op === 'RequestAccountDeletion').map((c) => c.variables.input)).toEqual([
    { password: 'wrong', confirm: 'delete' },
    { password: 'my passphrase', confirm: 'delete' },
  ])

  await fireEvent.press(screen.getAllByText('Keep my account')[1]!)
  await waitFor(() => expect(screen.queryByTestId('deletion-banner')).toBeNull())
  expect(await screen.findByText('Delete my account')).toBeTruthy()
})
