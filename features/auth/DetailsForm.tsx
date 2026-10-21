import { zodResolver } from '@hookform/resolvers/zod'
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { View } from 'react-native'
import type { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { CompleteRegistrationDocument, SignInOptionsDocument, SignOutDocument, ViewerDocument } from '@/graphql/generated/graphql'
import { markAgeRefused } from '@/lib/auth/age'
import { applyProblems, dateOfBirth } from '@/lib/auth/forms'
import { registrationCompleted, signedOut } from '@/lib/auth/session'
import { AgeRefused, birthDateHint, ConfirmBirthDate, useAgeRefused } from './AgeCheck'
import { AuthScreen } from './AuthScreen'
import { CheckRow, TextField } from './Controls'
import { copy } from './copy'
import { DateOfBirthField } from './DateOfBirthField'
import { FormField } from './FormField'
import { Notice } from './Notice'
import { currentTerms, detailsSchema } from './SignUpForm'

type Values = z.infer<typeof detailsSchema>
const FIELDS = ['displayName', 'dob', 'institutionalEmail'] as const

/**
 * Registration details for accounts created by a provider sign-in (ADR-0017), given once. The date of birth is
 * confirmed in words before it is sent. An answer under the minimum age (lvn-backend ADR-0091) makes the API erase this
 * unfinished account; the app then signs out and remembers the refusal. A refusal already on this device only closes
 * the form: the account is left alone, and the person may sign out.
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
    defaultValues: { displayName: '', dob: { day: '', month: '', year: '' }, institutionalEmail: '', terms: false as unknown as true },
  })
  const { errors, isSubmitting } = form.formState
  const dob = form.watch('dob')

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

  const send = async ({ terms: _terms, dob, institutionalEmail, ...values }: Values) => {
    setSending(true)
    try {
      const termsVersion = await currentTerms(options, refetchOptions)
      const { data } = await complete({
        variables: { input: { ...values, dateOfBirth: dateOfBirth(dob.day, dob.month, dob.year)!, institutionalEmail: institutionalEmail || null, acceptedTermsVersion: termsVersion } },
      })
      const payload = data!.completeRegistration
      if (payload.userErrors.some((p) => p.code === 'UNDER_MINIMUM_AGE')) {
        // The API erased this unfinished account: sign out here; the welcome screen shows the refusal from now on.
        await markAgeRefused()
        return await leave()
      }
      if (!payload.ok) {
        const problems = payload.userErrors.map((p) => (p.field?.at(-1) === 'dateOfBirth' ? { ...p, field: ['input', 'dob'] } : p))
        return setGeneral(applyProblems(problems, form.setError, FIELDS))
      }
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
          name="dob"
          render={({ field }) => (
            <FormField label={ts.dob} hint={birthDateHint(dateOfBirth(dob.day, dob.month, dob.year), ts.dobHint)} error={message('dob', ts.dobInvalid)}>
              <DateOfBirthField value={field.value} onChange={field.onChange} invalid={!!errors.dob} />
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
      <ConfirmBirthDate
        value={pending ? dateOfBirth(pending.dob.day, pending.dob.month, pending.dob.year) : null}
        busy={sending}
        onConfirm={() => pending && void send(pending)}
        onChange={() => setPending(null)}
      />
    </AuthScreen>
  )
}
