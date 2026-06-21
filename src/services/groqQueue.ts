// src/services/groqQueue.ts
// ─────────────────────────────────────────────────────────────────────────────
// WHY THIS FILE EXISTS
// Groq's free / on-demand tier enforces a tokens-per-minute (TPM) limit PER KEY,
// not just a requests-per-minute limit. Zephyra fires several large requests
// (the 5 reading chunks, chat, forecasts, chart insights) and some of them
// share the same key and run at the same time — e.g. generateFullReading()
// dispatches 3 of its 5 chunks on key1 simultaneously via Promise.all. Even
// though each individual request is small enough on its own, 3 of them
// landing on the same key in the same second blow through the per-minute
// token budget. Groq's gateway replies with HTTP 413, with a body that
// literally says "Request too large for model X ... tokens per minute (TPM):
// Limit N, Requested M" — it LOOKS like a payload-size error but it is
// actually a rate limit.
//
// THE FIX (no system-prompt or max_tokens changes needed):
//   1. Serialize requests that share the same API key (runQueued) — key1 and
//      key2 still run fully in parallel with each other, only requests on the
//      SAME key wait for each other.
//   2. Treat HTTP 413 like HTTP 429: back off and retry instead of giving up.
// ─────────────────────────────────────────────────────────────────────────────

type Task<T> = () => Promise<T>

const queueTails = new Map<string, Promise<unknown>>()

// Minimum spacing between two requests that share the same key. This keeps
// us from bursting several requests into the same TPM window.
const MIN_GAP_MS = 400

/**
 * Runs `task` only after every previously-queued task for the same `key`
 * has finished, with a small minimum gap between them. Different keys run
 * fully independently (and therefore in parallel).
 */
export function runQueued<T>(key: string, task: Task<T>): Promise<T> {
  const keyId = key || 'no-key'
  const previous = queueTails.get(keyId) ?? Promise.resolve()

  const result = previous.catch(() => {}).then(() => task())

  // Chain a small delay AFTER this task so the next queued caller on this
  // key waits a beat, regardless of whether this task succeeded or failed.
  const tail = result.then(
    () => new Promise<void>(resolve => setTimeout(resolve, MIN_GAP_MS)),
    () => new Promise<void>(resolve => setTimeout(resolve, MIN_GAP_MS)),
  )
  queueTails.set(keyId, tail)

  return result
}

/**
 * fetch() wrapper that treats HTTP 413 from Groq the same way as HTTP 429:
 * back off for a bit and retry, instead of treating it as a hard failure.
 * (See file header — 413 from Groq's free tier is almost always a
 * tokens-per-minute rate limit, not an actually oversized request body.)
 */
export async function fetchGroqWithBackoff(
  url: string,
  init: RequestInit,
  maxAttempts: number = 3,
): Promise<Response> {
  let lastResponse: Response | null = null

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(url, init)

    if (res.status !== 413 && res.status !== 429) {
      return res
    }

    lastResponse = res
    if (attempt === maxAttempts - 1) break

    const retryAfterHeader = res.headers.get('Retry-After')
    const waitMs = retryAfterHeader
      ? Math.min(parseInt(retryAfterHeader, 10) * 1000, 20000)
      : 3500 + attempt * 3000

    console.warn(`[Zephyra] GROQ ${res.status} (rate limit) — backing off ${waitMs}ms, attempt ${attempt + 1}/${maxAttempts}`)
    await new Promise(resolve => setTimeout(resolve, waitMs))
  }

  return lastResponse as Response
}
