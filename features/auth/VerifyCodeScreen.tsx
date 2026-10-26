import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { ResendInstitutionalEmailCodeDocument, SetInstitutionalEmailDocument, VerifyInstitutionalEmailDocument, ViewerDocument } from '@/graphql/generated/graphql'
import { refreshViewer } from '@/lib/auth/viewer'
import { AuthScreen } from './AuthScreen'
import { TextField } from './Controls'
import { copy } from './copy'
import { FormField } from './FormField'
import { Notice } from './Notice'

const close = () => (router.canGoBack() ? router.back() : router.replace('/'))

/** The 6-digit code sent to a college or organisation email (ADR-0017). */
export function VerifyCodeScreen() {
  const t = copy.verify
  const client = useApolloClient()
  const { data } = useQuery(ViewerDocument)
  const [verify, { loading }] = useMutation(VerifyInstitutionalEmailDocument)
  const [resend] = useMutation(ResendInstitutionalEmailCodeDocument)
  const [code, setCode] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const viewer = data?.viewer

  if (!viewer) {
    return (
      <AuthScreen title={t.codeTitle}>
        <ActivityIndicator accessibilityLabel="Loading" />
      </AuthScreen>
    )
  }
  const status = String(viewer.institutionalEmailStatus ?? 'NONE')
  if (status === 'CONFIRMED') {
    return (
      <AuthScreen title={t.codeTitle}>
        <Notice tone="success">{t.codeDone}</Notice>
        <Button size="lg" onPress={close}>
          <Text>Continue</Text>
        </Button>
      </AuthScreen>
    )
  }
  if (status === 'PENDING_REVIEW' || status === 'NEEDS_REVIEW') {
    return (
      <AuthScreen title={t.codeTitle}>
        <Notice tone="info">{t.needsReview}</Notice>
        <Button size="lg" onPress={close}>
          <Text>Continue</Text>
        </Button>
      </AuthScreen>
    )
  }
  if (status === 'NONE' || status === 'REFUSED' || !viewer.institutionalEmail) {
    return <AddCollegeEmail refused={status === 'REFUSED'} onClose={close} />
  }

  const submit = async () => {
    setProblem(null)
    setNote(null)
    try {
      const { data: res } = await verify({ variables: { code } })
      // The mutation does not return the account. Reload it, or `verified` stays as it was at sign-in.
      if (res?.verifyInstitutionalEmail.ok) {
        await refreshViewer(client)
        return
      }
      // A wrong code is cleared so the next one is typed fresh rather than edited digit by digit.
      setCode('')
      setProblem(res?.verifyInstitutionalEmail.userErrors[0]?.message ?? copy.errors.generic)
    } catch {
      setProblem(copy.errors.generic)
    }
  }
  const again = async () => {
    setProblem(null)
    try {
      const { data: res } = await resend()
      if (res?.resendInstitutionalEmailCode.ok) setNote(t.resent)
      else setProblem(res?.resendInstitutionalEmailCode.userErrors[0]?.message ?? copy.errors.generic)
    } catch {
      setProblem(copy.errors.generic)
    }
  }

  return (
    <AuthScreen title={t.codeTitle} lead={t.codeLead(viewer.institutionalEmail ?? '')}>
      <View className="gap-4">
        {note ? <Notice tone="success">{note}</Notice> : null}
        <FormField label={t.code} error={problem ?? undefined}>
          <TextField
            testID="code"
            accessibilityLabel={t.code}
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            invalid={!!problem}
            className="text-center text-2xl tracking-[8px]"
          />
        </FormField>
        <Button testID="verify-submit" size="lg" disabled={code.length !== 6 || loading} onPress={() => void submit()}>
          <Text>{t.submitCode}</Text>
        </Button>
        <Button variant="ghost" onPress={() => void again()}>
          <Text>{t.resend}</Text>
        </Button>
        <Button variant="ghost" onPress={close}>
          <Text>{t.later}</Text>
        </Button>
      </View>
    </AuthScreen>
  )
}

/** Adds a college or organisation email, then the code screen once the API has sent one. */
function AddCollegeEmail({ refused, onClose }: { refused: boolean; onClose: () => void }) {
  const t = copy.verify
  const client = useApolloClient()
  const [setEmail, { loading }] = useMutation(SetInstitutionalEmailDocument)
  const [email, setValue] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const save = async () => {
    setProblem(null)
    try {
      const { data } = await setEmail({ variables: { email: email.trim() } })
      if (data?.setInstitutionalEmail.ok) return void (await client.refetchQueries({ include: [ViewerDocument] }))
      setProblem(data?.setInstitutionalEmail.userErrors[0]?.message ?? t.refused)
    } catch {
      setProblem(copy.errors.generic)
    }
  }
  return (
    <AuthScreen title={t.addTitle} lead={t.addLead}>
      <View className="gap-4">
        {refused ? <Notice tone="error">{t.refused}</Notice> : null}
        <FormField label={t.addEmail} error={problem ?? undefined}>
          <TextField testID="college-email" accessibilityLabel={t.addEmail} value={email} onChangeText={setValue} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} invalid={!!problem} />
        </FormField>
        <Button testID="college-email-submit" size="lg" disabled={!email.trim() || loading} onPress={() => void save()}>
          <Text>{t.addSubmit}</Text>
        </Button>
        <Button variant="ghost" onPress={onClose}>
          <Text>{t.later}</Text>
        </Button>
      </View>
    </AuthScreen>
  )
}
