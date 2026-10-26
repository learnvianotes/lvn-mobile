/** Catalogue and session requests give up after 8 seconds (the same limit as the web app). */
export const REQUEST_DEADLINE_MS = 8_000

export async function fetchWithDeadline(input: RequestInfo | URL, init?: RequestInit, ms = REQUEST_DEADLINE_MS): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  const outer = init?.signal
  const onAbort = () => ctrl.abort()
  if (outer) {
    if (outer.aborted) ctrl.abort()
    else outer.addEventListener('abort', onAbort)
  }
  try {
    return await fetch(input as Parameters<typeof fetch>[0], { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
    outer?.removeEventListener('abort', onAbort)
  }
}
