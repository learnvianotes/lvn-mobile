import { CombinedGraphQLErrors } from '@apollo/client/errors'
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { applyProblems, type ProblemLike } from '@/lib/auth/forms'
import { copy } from './copy'

const INVITE_ONLY = /invite[-\s]?only/i

/** One sentence for an invite-only refusal. Every other message stays in the API's words. */
export function clarifyAuthError(message: string | null | undefined): string | null {
  if (!message) return null
  return INVITE_ONLY.test(message) ? copy.errors.inviteOnly : message
}

export function authErrorMessage(error: unknown, fallback: string): string {
  const raw = CombinedGraphQLErrors.is(error) ? error.errors[0]?.message : error instanceof Error ? error.message : ''
  return clarifyAuthError(raw) ?? fallback
}

/** Field errors and the alert above the form, with the invite-only refusal rewritten. */
export function presentProblems<T extends FieldValues>(problems: ProblemLike[], setError: UseFormSetError<T>, fields: readonly Path<T>[]): string | null {
  const rewritten = problems.map((p) => ({ ...p, message: clarifyAuthError(p.message) ?? p.message }))
  return clarifyAuthError(applyProblems(rewritten, setError, fields))
}
