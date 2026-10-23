import { useMutation, useQuery } from '@apollo/client/react'
import * as WebBrowser from 'expo-web-browser'
import { Download, FileArchive } from 'lucide-react-native'
import { useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { MyDataExportsDocument, RequestDataExportDocument } from '@/graphql/generated/graphql'
import { env } from '@/lib/env'

const size = (n: number) => (n < 1024 ** 2 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 ** 2).toFixed(1)} MB`)

/**
 * Your data on the phone (lvn-backend ADR-0018): prepare the archive of everything about you and download it in the
 * browser; importing notes is the next card (ImportCard).
 */
export function YourDataCard() {
  const exports = useQuery(MyDataExportsDocument, { fetchPolicy: 'cache-and-network' })
  const latest = exports.data?.myDataExports[0]
  const preparing = latest?.status === 'PENDING'
  useQuery(MyDataExportsDocument, { skip: !preparing, pollInterval: 5_000, fetchPolicy: 'network-only' })
  const [request, requesting] = useMutation(RequestDataExportDocument, { refetchQueries: [MyDataExportsDocument] })
  const [error, setError] = useState<string | null>(null)
  const primaryFg = String(useCSSVariable('--color-primary-foreground') ?? '#ffffff')
  const fg = String(useCSSVariable('--color-foreground') ?? '#152033')

  return (
    <View className="bg-card border-border gap-3 rounded-2xl border p-5" accessibilityLabel="Your data">
      <Text className="text-lg font-bold" accessibilityRole="header">
        Your data
      </Text>
      <Text className="text-muted-foreground text-sm">Download everything about you: your notes as Markdown and JSON with their pictures, and your account data. One archive a day; we email you when it is ready.</Text>
      {latest?.status === 'READY' && latest.downloadUrl ? (
        <Button onPress={() => void WebBrowser.openBrowserAsync(latest.downloadUrl!)} className="self-start">
          <Download size={16} color={primaryFg} />
          <Text>Download ({size(latest.sizeBytes ?? 0)})</Text>
        </Button>
      ) : null}
      {preparing ? (
        <View className="flex-row items-center gap-2" accessibilityRole="text">
          <ActivityIndicator size="small" />
          <Text className="text-muted-foreground text-sm">Preparing your archive…</Text>
        </View>
      ) : null}
      {error ? <Text className="text-destructive text-sm">{error}</Text> : null}
      {!preparing ? (
        <Button
          variant="outline"
          className="self-start"
          disabled={requesting.loading}
          onPress={async () => {
            setError(null)
            const res = await request().catch(() => null)
            const problem = res?.data?.requestDataExport.userErrors[0]?.message
            if (problem || !res) setError(problem ?? 'That did not work. Try again later.')
          }}
        >
          <FileArchive size={16} color={fg} />
          <Text>Prepare my archive</Text>
        </Button>
      ) : null}
      <Text className="text-muted-foreground text-xs" onPress={() => void WebBrowser.openBrowserAsync(new URL('/profile#your-data', env.EXPO_PUBLIC_WEB_URL).toString())}>
        Importing notes from other apps happens on the web — open your account there.
      </Text>
    </View>
  )
}
