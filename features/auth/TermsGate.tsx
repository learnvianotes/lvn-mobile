import { useMutation, useQuery } from '@apollo/client/react'
import { Portal } from '@rn-primitives/portal'
import { router, usePathname } from 'expo-router'
import { FileText } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { Outcome, Pill } from '@/features/shell/Form'
import { SupportLink } from '@/features/shell/SupportLink'
import { AcceptTermsDocument, TermsStatusDocument } from '@/graphql/generated/graphql'
import { env } from '@/lib/env'
import { openInBrowser } from '@/lib/open-external'

/** The documents people accept (lvn-web's features/legal/documents.ts): one version covers all three. */
const DOCUMENTS = [
  { title: 'Terms of Service', path: '/legal/terms' },
  { title: 'Privacy Policy', path: '/legal/privacy' },
  { title: 'Content licence', path: '/legal/content-licence' },
]

/**
 * Re-prompt on material change (spec §15.2) on the phone: when the Terms, Privacy Policy and content licence have a
 * new version, the app waits until it is accepted. The Profile tab stays open, so people who do not agree can sign out.
 */
export function TermsGate() {
  const accent = String(useCSSVariable('--color-primary') ?? '#1e4d8c')
  const pathname = usePathname()
  const status = useQuery(TermsStatusDocument, { fetchPolicy: 'cache-and-network' })
  const [accept, accepting] = useMutation(AcceptTermsDocument)
  const [error, setError] = useState<string | null>(null)
  const open = status.data?.viewer?.termsAccepted === false && pathname !== '/settings'
  if (!open) return null
  const agree = async () => {
    setError(null)
    const res = await accept({ variables: { version: status.data!.termsVersion } }).catch(() => null)
    if (res?.data?.acceptTerms.ok) await status.refetch()
    else setError(res?.data?.acceptTerms.userErrors[0]?.message ?? 'That did not work. Try again.')
  }
  return (
    <Portal name="terms-gate">
      <View className="absolute inset-0 justify-center bg-black/50 p-5" accessibilityViewIsModal>
        <View className="bg-card gap-4 rounded-3xl p-5">
          <Text className="text-xl font-extrabold" accessibilityRole="header">
            We have updated our terms
          </Text>
          <Text className="text-muted-foreground text-sm">Please read what changed and accept to keep using LearnViaNotes.</Text>
          {DOCUMENTS.map((d) => (
            <Pressable key={d.path} accessibilityRole="link" onPress={() => openInBrowser(new URL(d.path, env.EXPO_PUBLIC_WEB_URL).toString())} className="border-border flex-row items-center gap-2 rounded-xl border px-3 py-2.5">
              <FileText size={16} color={accent} />
              <Text className="font-medium">{d.title}</Text>
            </Pressable>
          ))}
          <SupportLink className="min-h-10 justify-center self-start" />
          <Outcome message={error ? { ok: false, text: error } : null} />
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <Pressable accessibilityRole="link" onPress={() => router.navigate('/settings')} className="py-2">
              <Text className="text-muted-foreground text-sm">Not now — sign out</Text>
            </Pressable>
            <Pill label="Accept and continue" primary disabled={accepting.loading} onPress={() => void agree()} />
          </View>
        </View>
      </View>
    </Portal>
  )
}
