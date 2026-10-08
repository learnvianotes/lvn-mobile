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
 * Day, month and year typed into three fields (GOV.UK's pattern for a date people know by heart, rather than a
 * picker) as the API's `YYYY-MM-DD`, or null when it is not a real past date.
 */
export function dateOfBirth(day: string, month: string, year: string, today = new Date()): string | null {
  const [d, m, y] = [day, month, year].map((v) => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN)) as [number, number, number]
  if (!(y >= 1900 && m >= 1 && m <= 12 && d >= 1)) return null
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d || date.getTime() > today.getTime()) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
