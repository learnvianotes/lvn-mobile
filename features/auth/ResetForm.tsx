import { useMutation } from '@apollo/client/react'
import { router } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { RequestPasswordResetDocument } from '@/graphql/generated/graphql'
import { AuthScreen } from './AuthScreen'
import { TextField } from './Controls'
import { copy } from './copy'
import { FormField } from './FormField'
import { Notice } from './Notice'

/**
 * Asks for a reset link. The link opens lvn-web's /reset?token= (the API's WEB_URL): until Android App Links and iOS
 * universal links are set up, a new password is chosen in the browser.
 */
export function ResetForm() {
  const t = copy.reset
  const [request, { loading }] = useMutation(RequestPasswordResetDocument)
  const [email, setEmail] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [state, setState] = useState<'idle' | 'sent' | string>('idle')

  const submit = async () => {
    const value = email.trim()
    setInvalid(!z.email().safeParse(value).success)
    if (!z.email().safeParse(value).success) return
    try {
      const { data } = await request({ variables: { email: value } })
      // Always the same sentence. A refusal that names an unknown address would tell the person whether the account exists.
      setState(data?.requestPasswordReset ? 'sent' : copy.errors.generic)
    } catch {
      setState(copy.errors.generic)
    }
  }

  return (
    <AuthScreen title={t.title} lead={t.lead}>
      <View className="gap-4">
        {state === 'sent' ? <Notice tone="success">{t.sent}</Notice> : state !== 'idle' ? <Notice>{state}</Notice> : null}
        <FormField label={t.email} error={invalid ? copy.errors.email : undefined}>
          <TextField testID="reset-email" accessibilityLabel={t.email} value={email} onChangeText={setEmail} invalid={invalid} keyboardType="email-address" autoCapitalize="none" autoComplete="email" onSubmitEditing={() => void submit()} />
        </FormField>
        <Button size="lg" disabled={loading} onPress={() => void submit()}>
          <Text>{t.submit}</Text>
        </Button>
        <Button variant="ghost" onPress={() => (router.canGoBack() ? router.back() : router.replace('/sign-in'))}>
          <Text>{t.back}</Text>
        </Button>
      </View>
    </AuthScreen>
  )
}
