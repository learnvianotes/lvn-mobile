export const CLASS_ROLE = { TEACHER: 'Teacher', TA: 'TA', STUDENT: 'Student' } as const

/** Codes are typed by hand: spaces and dashes are dropped, letters made upper case (lvn-backend ADR-0046). */
export const cleanCode = (code: string) => code.replace(/[\s-]+/g, '').toUpperCase()
