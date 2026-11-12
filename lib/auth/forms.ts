import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'

export interface ProblemLike {
  field: string[] | null
  message: string
  code: string
}

/**
 * Puts the API's userErrors on their form fields (`["input", "email"]` → `email`); anything without a field is
 * returned for an alert above the form.
 */
export function applyProblems<T extends FieldValues>(problems: ProblemLike[], setError: UseFormSetError<T>, fields: readonly Path<T>[]): string | null {
  let general: string | null = null
  for (const p of problems) {
    const name = p.field?.at(-1) as Path<T> | undefined
    if (name && fields.includes(name)) setError(name, { type: 'server', message: p.message })
    else general ??= p.message
  }
  return general
}

/**
 * Whole years the sign-up form accepts. `AGE_MIN` is the account floor the API enforces (lvn-backend ADR-0091; it is
 * 13, after 8, after 18) — change it here when that floor changes. Ages 13 to 17 are sent and join as a restricted
 * account, with no parent or guardian step. 120 is still the oldest age the field allows. The API checks the same
 * floor again.
 */
export const AGE_MIN = 13
export const AGE_MAX = 120

/** Why an age field's text is not an age: empty, not a whole number, or outside AGE_MIN to AGE_MAX. */
export type AgeProblem = 'required' | 'whole' | 'range'

/**
 * What is wrong with the age typed into its number field, or null for a whole number from AGE_MIN to AGE_MAX. Digits
 * only, so "17.5", "1e2" or "18 years" are 'whole'; a whole number outside the range ("0", "12", "121") is 'range'.
 * The API checks the same rules again.
 */
export function ageProblem(text: string): AgeProblem | null {
  const value = text.trim()
  if (!value) return 'required'
  if (!/^-?\d+$/.test(value)) return 'whole'
  const age = Number(value)
  return age < AGE_MIN || age > AGE_MAX ? 'range' : null
}

/** The age field's text as the API's `age` (whole years), or null when ageProblem finds something wrong with it. */
export function wholeYears(text: string): number | null {
  return ageProblem(text) ? null : Number(text.trim())
}
