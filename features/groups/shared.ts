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

export const ROLE = { OWNER: 'Owner', ADMIN: 'Admin', MODERATOR: 'Moderator', MEMBER: 'Member', MENTOR: 'Mentor' } as const
