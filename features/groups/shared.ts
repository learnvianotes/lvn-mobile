import { CombinedGraphQLErrors } from '@apollo/client/errors'
import type { Doc } from '@/lib/contracts/validation'

/** Runs one change; returns what went wrong in the API's words, or null (refusals come as errors, lvn-backend §6.2). */
export async function attempt(run: () => Promise<{ data?: unknown }>, fallback = 'That did not work. Try again.'): Promise<string | null> {
  try {
    const res = await run()
    const payload = Object.values((res.data ?? {}) as Record<string, { userErrors?: { message: string }[] } | null>)[0]
    return payload?.userErrors?.[0]?.message ?? null
  } catch (e) {
    return CombinedGraphQLErrors.is(e) ? (e.errors[0]?.message ?? fallback) : fallback
  }
}

/** Plain text, one paragraph per line, as the rich-text document a post holds. */
export function textToDoc(text: string): Doc {
  const paragraphs = text.split(/\n+/).map((l) => l.trim()).filter(Boolean)
  return { type: 'doc', content: paragraphs.map((p) => ({ type: 'paragraph', content: [{ type: 'text', text: p }] })) } as Doc
}

/** Plain text of a post's or comment's document, one line per paragraph, for editing it again. */
export function docToText(doc: unknown): string {
  return ((doc as Doc | null)?.content ?? []).map((p) => ((p as { content?: { text?: string }[] }).content ?? []).map((n) => n.text ?? '').join('')).join('\n')
}

export const ROLE = { OWNER: 'Owner', ADMIN: 'Admin', MODERATOR: 'Moderator', MEMBER: 'Member', MENTOR: 'Mentor' } as const

export const TYPE = {
  COMMUNITY: { label: 'Study group', hint: 'Posts, shared notes and discussions.' },
  PROJECT: { label: 'Project workspace', hint: 'A team building something: a repository, ideas, doubts for a mentor, and a showcase.' },
} as const

export const PRIVACY = {
  PUBLIC: { label: 'Public', hint: 'Anyone can find it and ask to join. Posts and notes stay with members.' },
  PRIVATE: { label: 'Private', hint: 'Not listed: people join with its link and your approval.' },
} as const

/** Who outranks whom in a group: people change only the roles of those below them (ADR-0045). */
export const RANK = { OWNER: 4, ADMIN: 3, MODERATOR: 2, MEMBER: 1, MENTOR: 1 } as const
