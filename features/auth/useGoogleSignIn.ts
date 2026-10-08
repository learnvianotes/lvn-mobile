import { useMutation, useQuery } from '@apollo/client/react'
import { useState } from 'react'
import { SignInOptionsDocument, SignInWithGoogleDocument } from '@/graphql/generated/graphql'
import { googleAvailable, googleIdToken } from '@/lib/auth/google'
import { copy } from './copy'
import { useFinishSignIn } from './useFinishSignIn'

/**
 * Google sign-in for any screen (ADR-0007): offered when the API and this build both have it. One tap opens Google's
 * account chooser; a returning account lands on Home, a new one on its registration details (app/_layout.tsx).
 */
export function useGoogleSignIn() {
  const { data } = useQuery(SignInOptionsDocument)
  const [exchange] = useMutation(SignInWithGoogleDocument)
  const finish = useFinishSignIn()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signIn = async () => {
    setError(null)
    setBusy(true)
    try {
      const idToken = await googleIdToken()
      if (!idToken) return
      const { data: res } = await exchange({ variables: { idToken } })
      const payload = res?.signInWithGoogle
      if (!payload?.session) throw new Error(payload?.userErrors[0]?.message ?? copy.providers.failed)
      await finish(payload.session)
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : copy.providers.failed)
    } finally {
      setBusy(false)
    }
  }

  return { available: !!data?.signInOptions.google && googleAvailable(), busy, error, signIn }
}
