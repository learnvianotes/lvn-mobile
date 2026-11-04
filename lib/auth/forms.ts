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

/** The ages the API accepts, in whole years (lvn-backend ADR-0104). The minimum age for an account is the API's alone. */
export const AGE_MIN = 1
export const AGE_MAX = 120

/** Why an age field's text is not an age: empty, not a whole number, or outside AGE_MIN to AGE_MAX. */
export type AgeProblem = 'required' | 'whole' | 'range'

/**
 * What is wrong with the age typed into its number field, or null for a whole number from AGE_MIN to AGE_MAX. Digits
 * only, so "17.5", "1e2" or "18 years" are 'whole'; a whole number outside the range ("0", "-3", "121") is 'range'.
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
