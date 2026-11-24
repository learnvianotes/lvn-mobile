import { useMutation } from '@apollo/client/react'
import { Link } from 'expo-router'
import { LockKeyhole } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { RequestSignInCodeDocument, SignInDocument, SignInWithCodeDocument } from '@/graphql/generated/graphql'
import { AuthScreen } from './AuthScreen'
import { TextField } from './Controls'
import { copy } from './copy'
import { authErrorMessage, clarifyAuthError } from './errors'
import { FormField } from './FormField'
import { Notice } from './Notice'
import { ProviderButtons } from './ProviderButtons'
import { useFinishSignIn } from './useFinishSignIn'

type Step = { kind: 'email' } | { kind: 'password' } | { kind: 'code'; email: string }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RESEND_AFTER = 30

/**
 * Sign in (lvn-backend ADR-0115): Google, then the email. The email gets a 6-digit code by default; a password is one
 * tap away. Passkeys come to the app once its asset links are published.
 */
export function SignInForm() {
  const t = copy.signIn
  const finish = useFinishSignIn()
  const [requestCode] = useMutation(RequestSignInCodeDocument)
  const [withCode] = useMutation(SignInWithCodeDocument)
  const [withPassword] = useMutation(SignInDocument)
  const [step, setStep] = useState<Step>({ kind: 'email' })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [general, setGeneral] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [wait, setWait] = useState(0)

  useEffect(() => {
    if (wait <= 0) return
    const timer = setTimeout(() => setWait((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [wait])

  const clear = () => {
    setGeneral(null)
    setNotice(null)
    setEmailError(null)
    setFieldError(null)
  }

  const run = async (work: () => Promise<void>) => {
    setBusy(true)
    try {
      await work()
    } catch (e) {
      setGeneral(authErrorMessage(e, copy.errors.generic))
    } finally {
      setBusy(false)
    }
  }

  // Keyboards often add a space after an autocompleted address; it is not part of the email.
  const address = email.trim()
  const checkEmail = () => {
    if (EMAIL.test(address)) return true
    setEmailError(copy.errors.email)
    return false
  }

  const sendCode = () => {
    clear()
    if (!checkEmail()) return
    void run(async () => {
      const { data } = await requestCode({ variables: { email: address } })
      const problem = data?.requestSignInCode.userErrors[0]
      if (problem) return setGeneral(clarifyAuthError(problem.message))
      setStep({ kind: 'code', email: address })
      setCode('')
      setWait(RESEND_AFTER)
    })
  }

  const resend = () => {
    clear()
    void run(async () => {
      if (step.kind !== 'code') return
      const { data } = await requestCode({ variables: { email: step.email } })
      const problem = data?.requestSignInCode.userErrors[0]
      if (problem) return setGeneral(clarifyAuthError(problem.message))
      setNotice(t.resent)
      setWait(RESEND_AFTER)
    })
  }

  const submitCode = () => {
    clear()
    if (step.kind !== 'code') return
    if (!/^\d{6}$/.test(code.replace(/\s+/g, ''))) return setFieldError(copy.errors.required)
    void run(async () => {
      const { data } = await withCode({ variables: { email: step.email, code } })
      const payload = data?.signInWithCode
      if (payload?.session) return void (await finish(payload.session))
      setCode('')
      setGeneral(clarifyAuthError(payload?.userErrors[0]?.message) ?? copy.errors.generic)
    })
  }

  const submitPassword = () => {
    clear()
    if (!checkEmail()) return
    if (!password) return setFieldError(copy.errors.required)
    void run(async () => {
      const { data } = await withPassword({ variables: { input: { email: address, password } } })
      const payload = data?.signIn
      if (payload?.session) return void (await finish(payload.session))
      // The email stays; a refused password is cleared to be typed again.
      setPassword('')
      setGeneral(clarifyAuthError(payload?.userErrors[0]?.message) ?? copy.errors.generic)
    })
  }

  if (step.kind === 'code') {
    return (
      <AuthScreen title={t.codeTitle} lead={t.codeLead(step.email)}>
        <View className="gap-4">
          {general ? <Notice>{general}</Notice> : null}
          {notice ? <Notice tone="info">{notice}</Notice> : null}
          <FormField label={t.code} error={fieldError ?? undefined}>
            <TextField
              testID="sign-in-code"
              accessibilityLabel={t.code}
              value={code}
              onChangeText={(value) => setCode(value.replace(/[^\d ]/g, ''))}
              invalid={!!fieldError}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={7}
              autoFocus
              onSubmitEditing={submitCode}
              className="font-mono text-lg"
            />
          </FormField>
          <Button testID="sign-in-code-submit" size="lg" disabled={busy} onPress={submitCode}>
            <Text>{t.codeSubmit}</Text>
          </Button>
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <Button variant="link" size="sm" className="px-0" disabled={busy || wait > 0} onPress={resend}>
              <Text>{wait > 0 ? t.resendIn(wait) : t.resend}</Text>
            </Button>
            <Button variant="link" size="sm" className="px-0" onPress={() => (clear(), setStep({ kind: 'email' }))}>
              <Text>{t.otherEmail}</Text>
            </Button>
          </View>
        </View>
      </AuthScreen>
    )
  }

  const passwordMode = step.kind === 'password'
  return (
    <AuthScreen title={t.title} lead={t.lead}>
      <ProviderButtons />
      <View className="gap-4">
        {general ? <Notice>{general}</Notice> : null}
        <FormField label={t.email} error={emailError ?? undefined}>
          <TextField
            testID="sign-in-email"
            accessibilityLabel={t.email}
            value={email}
            onChangeText={(value) => {
              setEmail(value)
              setEmailError(null)
              setGeneral(null)
            }}
            invalid={!!emailError}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            onSubmitEditing={passwordMode ? undefined : sendCode}
          />
        </FormField>
        {passwordMode ? (
          <FormField label={t.password} error={fieldError ?? undefined}>
            <TextField testID="sign-in-password" accessibilityLabel={t.password} value={password} onChangeText={setPassword} invalid={!!fieldError} secureTextEntry autoComplete="current-password" textContentType="password" onSubmitEditing={submitPassword} />
          </FormField>
        ) : null}
        <Button testID="sign-in-submit" size="lg" disabled={busy} onPress={passwordMode ? submitPassword : sendCode}>
          <Text>{passwordMode ? t.submit : t.emailCode}</Text>
        </Button>
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <Button
            testID="sign-in-mode"
            variant="link"
            size="sm"
            className="px-0"
            onPress={() => {
              clear()
              setStep(passwordMode ? { kind: 'email' } : { kind: 'password' })
            }}
          >
            <Text>{passwordMode ? t.useCode : t.usePassword}</Text>
          </Button>
          {passwordMode ? (
            <Link href="/reset" asChild>
              <Button variant="link" size="sm" className="px-0">
                <Text>{t.forgot}</Text>
              </Button>
            </Link>
          ) : null}
        </View>
      </View>
      <View className="flex-row items-start gap-2">
        <View className="pt-0.5">
          <LockKeyhole size={14} strokeWidth={1.5} color="#66625b" />
        </View>
        <Text className="text-muted-foreground flex-1 text-xs">{t.secure}</Text>
      </View>
      <View className="flex-row flex-wrap items-center justify-center gap-1">
        <Text className="text-muted-foreground text-sm">{t.noAccount}</Text>
        <Link href="/sign-up" replace asChild>
          <Button variant="link" size="sm" className="px-1">
            <Text>{t.signUp}</Text>
          </Button>
        </Link>
      </View>
    </AuthScreen>
  )
}
