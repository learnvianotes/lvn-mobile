import { zodResolver } from '@hookform/resolvers/zod'
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { View } from 'react-native'
import type { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { CompleteRegistrationDocument, SignInOptionsDocument, SignOutDocument, ViewerDocument } from '@/graphql/generated/graphql'
import { isAgeRefusal, markAgeRefused } from '@/lib/auth/age'
import { applyProblems, wholeYears } from '@/lib/auth/forms'
import { registrationCompleted, signedOut } from '@/lib/auth/session'
import { AgeField } from './AgeField'
import { AgeRefused, ConfirmAge, useAgeRefused } from './AgeCheck'
import { AuthScreen } from './AuthScreen'
import { CheckRow, TextField } from './Controls'
import { copy } from './copy'
import { FormField } from './FormField'
import { Notice } from './Notice'
import { currentTerms, detailsSchema } from './SignUpForm'

type Values = z.infer<typeof detailsSchema>
const FIELDS = ['displayName', 'age', 'institutionalEmail'] as const

/**
 * Registration details for accounts created by a provider sign-in (ADR-0017), given once. The age, in whole years
 * (lvn-backend ADR-0104), is confirmed in words before it is sent. An answer under 8 (ADR-0091) makes the
 * API put this account on hold (`AGE_BLOCKED`) and end its sessions; the app then signs out and remembers the refusal.
 * Ages 8 to 17 are sent and join as a restricted account, with no parent or guardian step.
 * A refusal already on this device only closes the form: the account is left alone, and the person may sign out.
 */
export function DetailsForm() {
  const t = copy.details
  const ts = copy.signUp
  const client = useApolloClient()
  const { data: viewer } = useQuery(ViewerDocument)
  const { data: options, refetch: refetchOptions } = useQuery(SignInOptionsDocument)
  const [complete] = useMutation(CompleteRegistrationDocument)
  const [signOut] = useMutation(SignOutDocument)
  const [general, setGeneral] = useState<string | null>(null)
  const refused = useAgeRefused()
  const [pending, setPending] = useState<Values | null>(null)
  const [sending, setSending] = useState(false)
  const form = useForm<Values>({
    resolver: zodResolver(detailsSchema),
    defaultValues: { displayName: '', age: '', institutionalEmail: '', terms: false as unknown as true },
  })
  const { errors, isSubmitting } = form.formState

  // Provider accounts arrive with a name; offer it.
  const name = viewer?.viewer?.displayName
  useEffect(() => {
    if (name && !form.getValues('displayName')) form.setValue('displayName', name)
  }, [name, form])

  const onSubmit = form.handleSubmit((values) => {
    setGeneral(null)
    setPending(values)
  })

  const leave = async () => {
    await signOut().catch(() => undefined)
    await client.clearStore()
    await signedOut()
  }

  const send = async ({ terms: _terms, age, institutionalEmail, ...values }: Values) => {
    setSending(true)
    try {
      const termsVersion = await currentTerms(options, refetchOptions)
      const { data } = await complete({
        variables: { input: { ...values, age: wholeYears(age)!, institutionalEmail: institutionalEmail || null, acceptedTermsVersion: termsVersion } },
      })
      const payload = data!.completeRegistration
      if (payload.userErrors.some(isAgeRefusal)) {
        // The API put this account on hold and ended its sessions: sign out here; the welcome screen shows the refusal.
        await markAgeRefused()
        return await leave()
      }
      // An age the API refuses is on `["input", "age"]`, this form's field.
      if (!payload.ok) return setGeneral(applyProblems(payload.userErrors, form.setError, FIELDS))
      await client.refetchQueries({ include: [ViewerDocument] })
      registrationCompleted(institutionalEmail ? '/verify' : undefined)
    } catch {
      setGeneral(copy.errors.generic)
    } finally {
      setPending(null)
      setSending(false)
    }
  }

  const message = (n: (typeof FIELDS)[number], fallback: string) => (errors[n] ? (errors[n]!.type === 'server' ? errors[n]!.message : fallback) : undefined)

  if (refused) {
    return (
      <AuthScreen title={t.title(name?.split(' ')[0])}>
        <AgeRefused
          action={
            <Button testID="details-sign-out" variant="outline" className="self-start" onPress={() => void leave()}>
              <Text>{t.signOut}</Text>
            </Button>
          }
        />
      </AuthScreen>
    )
  }

  return (
    <AuthScreen title={t.title(name?.split(' ')[0])} lead={t.lead}>
      <View className="gap-4">
        {general ? <Notice>{general}</Notice> : null}
        <Controller
          control={form.control}
          name="displayName"
          render={({ field }) => (
            <FormField label={ts.name} error={message('displayName', copy.errors.required)}>
              <TextField testID="details-name" accessibilityLabel={ts.name} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} invalid={!!errors.displayName} autoComplete="name" autoCapitalize="words" />
            </FormField>
          )}
        />
        <Controller
          control={form.control}
          name="age"
          render={({ field }) => (
            <FormField label={ts.age} hint={ts.ageHint} error={errors.age?.message}>
              <AgeField testID="details-age" value={field.value} onChange={field.onChange} onBlur={field.onBlur} invalid={!!errors.age} />
            </FormField>
          )}
        />
        <Controller
          control={form.control}
          name="institutionalEmail"
          render={({ field }) => (
            <FormField label={ts.institutionalEmail} hint={ts.institutionalHint} error={message('institutionalEmail', copy.errors.email)}>
              <TextField accessibilityLabel={ts.institutionalEmail} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} invalid={!!errors.institutionalEmail} keyboardType="email-address" autoCapitalize="none" />
            </FormField>
          )}
        />
        <Controller control={form.control} name="terms" render={({ field }) => <CheckRow testID="terms" label={ts.terms} checked={!!field.value} onChange={field.onChange} invalid={!!errors.terms} />} />
        {errors.terms ? <Text role="alert" className="text-destructive -mt-2 text-xs font-medium">{ts.termsRequired}</Text> : null}
        <Button testID="details-submit" size="lg" disabled={isSubmitting || sending} onPress={() => void onSubmit()}>
          <Text>{t.submit}</Text>
        </Button>
        <Button variant="ghost" onPress={() => void leave()}>
          <Text>{t.signOut}</Text>
        </Button>
      </View>
      <ConfirmAge
        value={pending ? wholeYears(pending.age) : null}
        busy={sending}
        onConfirm={() => pending && void send(pending)}
        onChange={() => setPending(null)}
      />
    </AuthScreen>
  )
}
