import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@apollo/client/react'
import { Link } from 'expo-router'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { View } from 'react-native'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { SignInDocument } from '@/graphql/generated/graphql'
import { applyProblems } from '@/lib/auth/forms'
import { AuthScreen } from './AuthScreen'
import { TextField } from './Controls'
import { copy } from './copy'
import { FormField } from './FormField'
import { Notice } from './Notice'
import { ProviderButtons } from './ProviderButtons'
import { useFinishSignIn } from './useFinishSignIn'

// Keyboards often add a space after an autocompleted address; it is not part of the email.
const schema = z.object({ email: z.string().trim().pipe(z.email()), password: z.string().min(1) })
type Values = z.infer<typeof schema>

export function SignInForm() {
  const t = copy.signIn
  const [signIn] = useMutation(SignInDocument)
  const finish = useFinishSignIn()
  const [general, setGeneral] = useState<string | null>(null)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setGeneral(null)
    try {
      const { data } = await signIn({ variables: { input: values } })
      const payload = data!.signIn
      if (payload.session) return await finish(payload.session)
      // The email stays; a refused password is cleared to be typed again.
      form.setValue('password', '')
      setGeneral(applyProblems(payload.userErrors, form.setError, ['email', 'password']))
    } catch {
      setGeneral(copy.errors.generic)
    }
  })

  return (
    <AuthScreen title={t.title} lead={t.lead}>
      <ProviderButtons />
      <View className="gap-4">
        {general ? <Notice>{general}</Notice> : null}
        <Controller
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormField label={t.email} error={errors.email ? copy.errors.email : undefined}>
              <TextField testID="sign-in-email" accessibilityLabel={t.email} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} invalid={!!errors.email} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
            </FormField>
          )}
        />
        <Controller
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormField label={t.password} error={errors.password ? (errors.password.type === 'server' ? errors.password.message : copy.errors.required) : undefined}>
              <TextField testID="sign-in-password" accessibilityLabel={t.password} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} invalid={!!errors.password} secureTextEntry autoComplete="current-password" textContentType="password" onSubmitEditing={() => void onSubmit()} />
            </FormField>
          )}
        />
        <Button testID="sign-in-submit" size="lg" disabled={isSubmitting} onPress={() => void onSubmit()}>
          <Text>{t.submit}</Text>
        </Button>
        <Link href="/reset" asChild>
          <Button variant="link">
            <Text>{t.forgot}</Text>
          </Button>
        </Link>
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
