import { ApolloProvider } from '@apollo/client/react'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import * as WebBrowser from 'expo-web-browser'
import { YourDataCard } from '@/features/data/YourDataCard'
import { createApolloClient } from '@/lib/apollo'
import { mockApi } from '../../support/api'
import { renderInApp } from '../../support/render'

/** Your data on the phone (lvn-backend ADR-0018): prepare the archive, then download it in the browser. */
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(async () => ({ type: 'opened' })) }))

const row = (over: object) => ({ __typename: 'DataExport', id: '01920000-0000-7000-8000-00000000d0e1', status: 'PENDING', requestedAt: '2026-10-09T10:00:00.000Z', expiresAt: null, sizeBytes: null, downloadUrl: null, ...over })

it('prepares the archive and opens the download', async () => {
  let state: 'none' | 'ready' = 'none'
  const api = mockApi({
    MyDataExports: () => ({ data: { myDataExports: state === 'none' ? [] : [row({ status: 'READY', sizeBytes: 2_400_000, downloadUrl: 'http://storage.test/export.zip', expiresAt: '2026-10-16T10:00:00.000Z' })] } }),
    RequestDataExport: () => {
      state = 'ready'
      return { data: { requestDataExport: { __typename: 'DataExportPayload', export: row({}), userErrors: [] } } }
    },
  })
  await renderInApp(
    <ApolloProvider client={createApolloClient()}>
      <YourDataCard />
    </ApolloProvider>,
  )
  fireEvent.press(await screen.findByText('Prepare my archive'))
  fireEvent.press(await screen.findByText('Download (2.3 MB)'))
  expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('http://storage.test/export.zip')
  await waitFor(() => expect(api.ops()).toContain('RequestDataExport'))
})
