import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@apollo/client/react'
import { Link } from 'expo-router'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { View } from 'react-native'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { SignInOptionsDocument, SignUpDocument } from '@/graphql/generated/graphql'
import { applyProblems, dateOfBirth } from '@/lib/auth/forms'
import { AuthScreen } from './AuthScreen'
import { CheckRow, TextField } from './Controls'
import { copy } from './copy'
import { DateOfBirthField } from './DateOfBirthField'
import { FormField } from './FormField'
import { Notice } from './Notice'
import { ProviderButtons } from './ProviderButtons'
import { useFinishSignIn } from './useFinishSignIn'

/** The registration details of ADR-0017, shared with DetailsForm. */
export const detailsSchema = z.object({
  displayName: z.string().trim().min(1),
  dob: z.object({ day: z.string(), month: z.string(), year: z.string() }).refine((d) => dateOfBirth(d.day, d.month, d.year) !== null),
  // Keyboards often add a space after an autocompleted address; it is not part of the email.
  institutionalEmail: z.string().trim().pipe(z.union([z.literal(''), z.email()])),
  terms: z.literal(true),
})

const schema = detailsSchema.extend({ email: z.string().trim().pipe(z.email()), password: z.string().min(10) })
type Values = z.infer<typeof schema>
const FIELDS = ['displayName', 'email', 'password', 'dob', 'institutionalEmail'] as const

/** The Terms version to accept (Query.termsVersion), fetched again if the first load failed (offline at launch). */
export async function currentTerms(loaded: { termsVersion: string } | undefined, refetch: () => Promise<{ data?: { termsVersion: string } }>): Promise<string> {
  const version = loaded?.termsVersion ?? (await refetch()).data?.termsVersion
  if (!version) throw new Error('terms version unavailable')
  return version
}

/** Email + password registration; GitHub and LinkedIn above it when configured. */
export function SignUpForm() {
  const t = copy.signUp
  const { data: options, refetch: refetchOptions } = useQuery(SignInOptionsDocument)
  const [signUp] = useMutation(SignUpDocument)
  const finish = useFinishSignIn()
  const [general, setGeneral] = useState<string | null>(null)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: '', email: '', password: '', dob: { day: '', month: '', year: '' }, institutionalEmail: '', terms: false as unknown as true },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async ({ terms: _terms, dob, institutionalEmail, email, ...values }) => {
    setGeneral(null)
    try {
      const termsVersion = await currentTerms(options, refetchOptions)
      const { data } = await signUp({
        variables: {
          input: {
            ...values,
            email,
            dateOfBirth: dateOfBirth(dob.day, dob.month, dob.year)!,
            institutionalEmail: institutionalEmail || null,
            acceptedTermsVersion: termsVersion,
          },
        },
      })
      const payload = data!.signUp
      if (payload.session) return await finish(payload.session, institutionalEmail ? '/verify' : undefined)
      // The API names `dateOfBirth`; the form's field is `dob`.
      const problems = payload.userErrors.map((p) => (p.field?.at(-1) === 'dateOfBirth' ? { ...p, field: ['input', 'dob'] } : p))
      setGeneral(applyProblems(problems, form.setError, FIELDS))
    } catch {
      setGeneral(copy.errors.generic)
    }
  })

  const message = (name: (typeof FIELDS)[number], fallback: string) => {
    const e = errors[name]
    if (!e) return undefined
    return e.type === 'server' ? e.message : fallback
  }

  return (
    <AuthScreen title={t.title} lead={t.lead}>
      <ProviderButtons />
      <View className="gap-4">
        {general ? <Notice>{general}</Notice> : null}
        <Controller
          control={form.control}
          name="displayName"
          render={({ field }) => (
            <FormField label={t.name} error={message('displayName', copy.errors.required)}>
              <TextField testID="sign-up-name" accessibilityLabel={t.name} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} invalid={!!errors.displayName} autoComplete="name" textContentType="name" autoCapitalize="words" />
            </FormField>
          )}
        />
        <Controller
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormField label={t.email} error={message('email', copy.errors.email)}>
              <TextField testID="sign-up-email" accessibilityLabel={t.email} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} invalid={!!errors.email} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
            </FormField>
          )}
        />
        <Controller
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormField label={t.password} hint={t.passwordHint} error={message('password', t.passwordHint)}>
              <TextField testID="sign-up-password" accessibilityLabel={t.password} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} invalid={!!errors.password} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
            </FormField>
          )}
        />
        <Controller
          control={form.control}
          name="dob"
          render={({ field }) => (
            <FormField label={t.dob} hint={t.dobHint} error={message('dob', t.dobInvalid)}>
              <DateOfBirthField value={field.value} onChange={field.onChange} invalid={!!errors.dob} />
            </FormField>
          )}
        />
        <Controller
          control={form.control}
          name="institutionalEmail"
          render={({ field }) => (
            <FormField label={t.institutionalEmail} hint={t.institutionalHint} error={message('institutionalEmail', copy.errors.email)}>
              <TextField testID="sign-up-institutional-email" accessibilityLabel={t.institutionalEmail} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} invalid={!!errors.institutionalEmail} keyboardType="email-address" autoCapitalize="none" />
            </FormField>
          )}
        />
        <Controller
          control={form.control}
          name="terms"
          render={({ field }) => <CheckRow testID="terms" label={t.terms} checked={!!field.value} onChange={field.onChange} invalid={!!errors.terms} />}
        />
        {errors.terms ? <Text role="alert" className="text-destructive -mt-2 text-xs font-medium">{t.termsRequired}</Text> : null}
        <Button testID="sign-up-submit" size="lg" disabled={isSubmitting} onPress={() => void onSubmit()}>
          <Text>{t.submit}</Text>
        </Button>
      </View>
      <View className="flex-row flex-wrap items-center justify-center gap-1">
        <Text className="text-muted-foreground text-sm">{t.haveAccount}</Text>
        <Link href="/sign-in" replace asChild>
          <Button variant="link" size="sm" className="px-1">
            <Text>{t.signIn}</Text>
          </Button>
        </Link>
      </View>
    </AuthScreen>
  )
}
