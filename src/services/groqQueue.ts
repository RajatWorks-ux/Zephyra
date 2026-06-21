// src/services/groqQueue.ts
// ─────────────────────────────────────────────────────────────────────────────
// WHY THIS FILE EXISTS
// NVIDIA NIM's free hosted tier enforces a requests-per-minute (RPM) limit per
// key (and, depending on the model, can also return size/throughput-shaped
// errors that behave like a rate limit). Zephyra fires several large requests
// (the 5 reading chunks, chat, forecasts, chart insights) and some of them
// share the same key and run at the same time — e.g. generateFullReading()
// dispatches multiple reading chunks on the same NVIDIA key simultaneously via
// Promise.all. Even though each individual request is small enough on its
// own, several of them landing on the same key in the same second can blow
// through the per-minute budget. The gateway can reply with HTTP 429 (rate
// limit) or, in some edge cases, HTTP 413 with a body that looks like a
// payload-size error but is functionally the same kind of "you sent too much,
// too fast" rejection.
//
// THE FIX (no system-prompt or max_tokens changes needed):
//   1. Serialize requests that share the same API key (runQueued) — calls
//      using different keys still run fully in parallel with each other,
//      only requests on the SAME key wait for each other.
//   2. Treat HTTP 413 like HTTP 429: back off and retry instead of giving up.
//
// NOTE ON NAMING: This file and its exported function names (runQueued,
// fetchGroqWithBackoff) are kept exactly as-is on purpose, even though the
// app's text AI now runs entirely on NVIDIA NIM (nvidia/nemotron-3-super-
// 120b-a12b) and no longer touches Groq's API at all. Renaming would mean
// touching every import across groqAI.ts, chatStore.ts, and forecastStore.ts
// for zero functional benefit — the queueing and backoff behavior is fully
// provider-agnostic and works identically against NVIDIA's endpoint.
// ─────────────────────────────────────────────────────────────────────────────

type Task<T> = () => Promise<T>

const queueTails = new Map<string, Promise<unknown>>()

// Minimum spacing between two requests that share the same key. This keeps
// us from bursting several requests into the same per-minute rate window.
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
 * fetch() wrapper that treats HTTP 413 from the NVIDIA NIM endpoint the same
 * way as HTTP 429: back off for a bit and retry, instead of treating it as a
 * hard failure. (See file header — 413 on a free-tier hosted endpoint is
 * almost always a rate/throughput limit in practice, not an actually
 * oversized request body.)
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

    console.warn(`[Zephyra] NVIDIA NIM ${res.status} (rate limit) — backing off ${waitMs}ms, attempt ${attempt + 1}/${maxAttempts}`)
    await new Promise(resolve => setTimeout(resolve, waitMs))
  }

  return lastResponse as Response
}
