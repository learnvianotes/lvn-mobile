import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { useEffect, useState } from 'react'
import { AppState, useWindowDimensions, View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { ViewerDocument } from '@/graphql/generated/graphql'
import { refreshViewer } from '@/lib/auth/viewer'
import { copy } from './copy'
import { ResendVerificationDocument } from './resendVerification'

type ResendResult = { resendVerification?: { ok: boolean; userErrors: { message: string }[] } | null }

/**
 * After login, when the sign-in email is still unconfirmed: resend the link, or reload the account
 * after the link was opened. Notes and study stay available; this does not gate them.
 * Stacks the actions on a narrow phone and keeps them on one row on a large one.
 */
export function VerifyEmailBanner() {
  const client = useApolloClient()
  const { data } = useQuery(ViewerDocument)
  const viewer = data?.viewer
  const [resend] = useMutation<ResendResult>(ResendVerificationDocument)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'resend' | 'check' | null>(null)
  const { width } = useWindowDimensions()
  const narrow = width < 400
  const unverified = !!viewer && !viewer.emailVerified

  useEffect(() => {
    if (!unverified) return
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshViewer(client).catch(() => undefined)
    })
    return () => sub.remove()
  }, [client, unverified])

  if (!unverified) return null
  const t = copy.verifyEmail
  const send = async () => {
    setBusy('resend')
    setError(null)
    setNote(null)
    try {
      const { data: res } = await resend()
      const payload = res?.resendVerification
      if (payload?.ok) setNote(t.sent)
      else setError(payload?.userErrors[0]?.message ?? t.failed)
    } catch {
      setError(t.failed)
    } finally {
      setBusy(null)
    }
  }
  const check = async () => {
    setBusy('check')
    setError(null)
    setNote(null)
    try {
      const next = await refreshViewer(client)
      if (next && !next.emailVerified) setNote(t.still)
    } catch {
      setError(t.failed)
    } finally {
      setBusy(null)
    }
  }

  return (
    <View className="border-border bg-secondary gap-3 rounded-2xl border p-4">
      <Text className="text-foreground text-sm leading-5">{t.lead}</Text>
      {note ? <Text className="text-success text-sm font-medium">{note}</Text> : null}
      {error ? (
        <Text accessibilityRole="alert" className="text-destructive text-sm">
          {error}
        </Text>
      ) : null}
      <View className={narrow ? 'gap-2' : 'flex-row flex-wrap gap-2'}>
        <Button accessibilityLabel={t.resend} size="default" className={narrow ? 'w-full' : 'min-w-36 flex-1'} disabled={busy !== null} onPress={() => void send()}>
          <Text>{busy === 'resend' ? t.sending : t.resend}</Text>
        </Button>
        <Button accessibilityLabel={t.check} variant="outline" size="default" className={narrow ? 'w-full' : 'min-w-36 flex-1'} disabled={busy !== null} onPress={() => void check()}>
          <Text>{busy === 'check' ? t.checking : t.check}</Text>
        </Button>
      </View>
    </View>
  )
}
