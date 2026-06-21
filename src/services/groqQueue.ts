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
//   2. Track an ESTIMATED token budget per key over a rolling 60s window, and
//      make queued callers actually WAIT until there's headroom before firing
//      — instead of firing immediately and only reacting after a 413 already
//      happened. This is the main upgrade: proactive spacing instead of a
//      flat, often-too-short 400ms gap.
//   3. Treat HTTP 413 like HTTP 429: back off and retry instead of giving up,
//      with backoff long enough to actually clear a 60s rolling TPM window,
//      and report the real wait time back to the queue so later attempts
//      don't immediately re-collide with the same limit.
// ─────────────────────────────────────────────────────────────────────────────

type Task<T> = () => Promise<T>

const queueTails = new Map<string, Promise<unknown>>()

// Minimum spacing between two requests that share the same key. This keeps
// us from bursting several requests into the same TPM window even when the
// token-budget estimate below is conservative or unavailable.
const MIN_GAP_MS = 400

// ── Rolling token-budget tracker (per key) ─────────────────────────────────────
// Groq's free tier TPM limit resets on a rolling basis. We don't have perfect
// visibility into the server's exact accounting, but we can keep a local,
// conservative estimate of "tokens this key has committed to in the last 60s"
// and use it to decide whether the NEXT request on this key should wait a
// little before firing — proactively, rather than only finding out via a 413
// after the fact. This never changes WHAT is sent, only WHEN.
const TPM_WINDOW_MS = 60_000

interface TokenEvent {
  tokens: number
  at: number
}

const tokenLog = new Map<string, TokenEvent[]>()

function pruneOld(events: TokenEvent[], now: number): TokenEvent[] {
  return events.filter(e => now - e.at < TPM_WINDOW_MS)
}

function recordTokens(keyId: string, tokens: number) {
  const now = Date.now()
  const events = pruneOld(tokenLog.get(keyId) ?? [], now)
  events.push({ tokens, at: now })
  tokenLog.set(keyId, events)
}

function estimatedTokensInWindow(keyId: string): number {
  const now = Date.now()
  const events = pruneOld(tokenLog.get(keyId) ?? [], now)
  tokenLog.set(keyId, events)
  return events.reduce((sum, e) => sum + e.tokens, 0)
}

/**
 * Rough token estimate for a request, used only to decide spacing — never to
 * alter the request itself. ~4 chars/token is a standard, conservative
 * approximation for English text; we also add the requested max_tokens since
 * that's the worst-case completion size Groq has to reserve budget for.
 */
function estimateRequestTokens(body: string, maxTokens: number): number {
  const promptTokens = Math.ceil(body.length / 4)
  return promptTokens + maxTokens
}

// Soft ceiling we try to stay under per key per rolling window. This is
// intentionally conservative (below the documented free-tier limits) so we
// proactively slow down BEFORE hitting a real 413, instead of after.
const SOFT_TPM_CEILING = 5500

/**
 * Runs `task` only after every previously-queued task for the same `key`
 * has finished, with spacing that scales with how much of this key's
 * rolling token budget is already committed. Different keys run fully
 * independently (and therefore in parallel).
 *
 * `estimatedTokens`, if provided, lets the queue proactively delay a request
 * that would likely blow the per-key TPM budget, rather than firing
 * immediately and relying solely on reactive 413 backoff.
 */
export function runQueued<T>(key: string, task: Task<T>, estimatedTokens: number = 0): Promise<T> {
  const keyId = key || 'no-key'
  const previous = queueTails.get(keyId) ?? Promise.resolve()

  const result = previous.catch(() => {}).then(async () => {
    if (estimatedTokens > 0) {
      const used = estimatedTokensInWindow(keyId)
      if (used + estimatedTokens > SOFT_TPM_CEILING) {
        // We're likely to collide with the real TPM limit — wait out enough
        // of the rolling window to free up headroom before sending.
        const overBy = used + estimatedTokens - SOFT_TPM_CEILING
        const waitMs = Math.min(Math.max(2000, overBy * 8), 15000)
        console.warn(`[Zephyra] Key ...${keyId.slice(-6)} near TPM budget (${used}+${estimatedTokens} est.) — proactively waiting ${waitMs}ms`)
        await new Promise(resolve => setTimeout(resolve, waitMs))
      }
      recordTokens(keyId, estimatedTokens)
    }
    return task()
  })

  // Chain a small delay AFTER this task so the next queued caller on this
  // key waits at least a beat, regardless of whether this task succeeded or
  // failed.
  const tail = result.then(
    () => new Promise<void>(resolve => setTimeout(resolve, MIN_GAP_MS)),
    () => new Promise<void>(resolve => setTimeout(resolve, MIN_GAP_MS)),
  )
  queueTails.set(keyId, tail)

  return result
}

// Allow callers to compute an estimate without duplicating the formula.
export { estimateRequestTokens }

/**
 * fetch() wrapper that treats HTTP 413 from Groq the same way as HTTP 429:
 * back off for a bit and retry, instead of treating it as a hard failure.
 * (See file header — 413 from Groq's free tier is almost always a
 * tokens-per-minute rate limit, not an actually oversized request body.)
 *
 * Backoff is intentionally longer than before and grows more aggressively
 * per attempt, because a rolling 60s TPM window needs real wall-clock time
 * to clear — a short backoff just re-collides with the same limit.
 */
export async function fetchGroqWithBackoff(
  url: string,
  init: RequestInit,
  maxAttempts: number = 4,
): Promise<Response> {
  let lastResponse: Response | null = null

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(url, init)

    if (res.status !== 413 && res.status !== 429) {
      return res
    }

    lastResponse = res

    // Read the body once — we need it both to detect a permanently-too-large
    // request and to find any wait-time hint Groq includes.
    let bodyText = ''
    try {
      bodyText = await res.clone().text()
    } catch {
      // Body already consumed or unreadable — proceed without it.
    }

    // Groq's error body includes the real numbers, e.g.:
    // "Limit 12000, Requested 31912" — if Requested is still bigger than
    // Limit, retrying the SAME request will NEVER succeed, on this minute or
    // any other, because the request itself exceeds the entire per-minute
    // budget. In that case, stop immediately instead of burning 4 attempts
    // and ~100 seconds on a guaranteed failure.
    const limitMatch = bodyText.match(/Limit\s+(\d+)/i)
    const requestedMatch = bodyText.match(/Requested\s+(\d+)/i)
    if (limitMatch && requestedMatch) {
      const limit = parseInt(limitMatch[1], 10)
      const requested = parseInt(requestedMatch[1], 10)
      if (requested > limit) {
        console.error(`[Zephyra] GROQ ${res.status} — request (${requested} tokens) permanently exceeds the per-minute limit (${limit} tokens). This will not succeed on retry; aborting attempts for this call. ${bodyText.slice(0, 200)}`)
        return res
      }
    }

    if (attempt === maxAttempts - 1) break

    const retryAfterHeader = res.headers.get('Retry-After')
    // Try to read Groq's own reported wait time from the error body when no
    // Retry-After header is present — Groq's 413/429 bodies often include
    // "try again in Xs" style messaging we can parse defensively.
    let bodyWaitMs: number | null = null
    const match = bodyText.match(/try again in ([\d.]+)s/i)
    if (match) bodyWaitMs = Math.ceil(parseFloat(match[1]) * 1000)

    const waitMs = retryAfterHeader
      ? Math.min(parseInt(retryAfterHeader, 10) * 1000, 25000)
      : bodyWaitMs
        ? Math.min(bodyWaitMs + 500, 25000)
        : Math.min(5000 + attempt * 5000, 25000)

    console.warn(`[Zephyra] GROQ ${res.status} (rate limit) — backing off ${waitMs}ms, attempt ${attempt + 1}/${maxAttempts}`)
    await new Promise(resolve => setTimeout(resolve, waitMs))
  }

  return lastResponse as Response
}
