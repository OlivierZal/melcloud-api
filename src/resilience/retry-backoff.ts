import axios, { type AxiosError, HttpStatusCode } from 'axios'

/*
 * HTTP 5xx status codes considered transient (server-side glitches that
 * retrying a short moment later can plausibly recover from). 500 is
 * intentionally excluded: it usually indicates an application bug on the
 * server, not a recoverable condition.
 */
const TRANSIENT_STATUSES: ReadonlySet<number> = new Set([
  HttpStatusCode.BadGateway,
  HttpStatusCode.GatewayTimeout,
  HttpStatusCode.ServiceUnavailable,
])

/*
 * Walk the `Error.cause` chain to find a nested AxiosError. Guards
 * against cycles via a visited set. Used by `isTransientServerError` so
 * that wrapped errors (e.g. Classic's `#onError` rethrows as
 * `new Error(msg, { cause: axiosError })`) are still correctly classified.
 */
const findAxiosError = (error: unknown): AxiosError | undefined => {
  const visited = new Set<object>()
  let current: unknown = error
  while (
    typeof current === 'object' &&
    current !== null &&
    !visited.has(current)
  ) {
    if (axios.isAxiosError(current)) {
      return current
    }
    visited.add(current)
    const { cause } = current as { cause?: unknown }
    current = cause
  }
  return undefined
}

/**
 * Predicate suitable for {@link RetryBackoffOptions.isRetryable}: returns
 * `true` for transient HTTP 5xx status codes (502 / 503 / 504) on axios
 * errors, including errors wrapped via `Error.cause`. All other inputs
 * return `false`.
 * @param error - The rejection reason thrown by an axios call.
 * @returns Whether the error represents a transient server failure.
 */
export const isTransientServerError = (error: unknown): boolean => {
  const axiosError = findAxiosError(error)
  const { status } = axiosError?.response ?? {}
  return typeof status === 'number' && TRANSIENT_STATUSES.has(status)
}

/**
 * Default transient-retry budget used by both Classic (`list()`
 * heartbeat) and Home (GET-only requests) clients. Keeping these in
 * one place prevents drift: if we decide to tune the upper bound or
 * jitter ratio, we update a single constant instead of two.
 */
export const DEFAULT_TRANSIENT_RETRY_OPTIONS = {
  initialDelayMs: 1000,
  jitterRatio: 0.25,
  maxDelayMs: 16_000,
  maxRetries: 4,
} as const satisfies Pick<
  RetryBackoffOptions,
  'initialDelayMs' | 'jitterRatio' | 'maxDelayMs' | 'maxRetries'
>

/** Options for {@link withRetryBackoff}. */
export interface RetryBackoffOptions {
  /** Maximum retry attempts after the initial try (0 disables retries). */
  readonly maxRetries: number

  /** Initial delay in milliseconds before the first retry. */
  readonly initialDelayMs: number

  /** Upper bound on the backoff delay. */
  readonly maxDelayMs: number

  /** Jitter ratio applied to each computed delay (`0..1`). */
  readonly jitterRatio: number

  /** Predicate deciding whether a thrown error is worth retrying. */
  readonly isRetryable: (error: unknown) => boolean

  /** Optional hook invoked before the next attempt. */
  readonly onRetry?: (attempt: number, error: unknown, delayMs: number) => void
}

const sleep = async (ms: number): Promise<void> =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

/*
 * Exponential backoff with symmetric uniform jitter around the base delay.
 * The jittered delay is sampled uniformly in
 * [base * (1 - ratio), base * (1 + ratio)] and clamped to [0, maxDelayMs].
 *
 * `Math.random()` is intentional here: retry timing is NOT
 * security-sensitive — it's only used to desynchronize concurrent retries
 * so a bursty error pattern doesn't resonate into a thundering herd.
 * SonarCloud's S2245 hotspot on this line is marked SAFE in the project
 * dashboard with that rationale.
 */
const computeDelay = (
  attempt: number,
  { initialDelayMs, jitterRatio, maxDelayMs }: RetryBackoffOptions,
): number => {
  const base = Math.min(initialDelayMs * 2 ** attempt, maxDelayMs)
  const jitter = base * jitterRatio * (Math.random() * 2 - 1)
  return Math.max(0, Math.min(base + jitter, maxDelayMs))
}

/**
 * Run `operation`, retrying on errors accepted by `options.isRetryable`.
 *
 * Uses exponential backoff with bounded jitter between attempts. Stops
 * and rethrows once `maxRetries` is exhausted or the error is judged
 * non-retryable.
 * @param operation - The async function to attempt; will be invoked up
 *   to `maxRetries + 1` times.
 * @param options - Backoff parameters and retry predicate.
 * @returns The operation's resolved value on first success.
 */
export const withRetryBackoff = async <T>(
  operation: () => Promise<T>,
  options: RetryBackoffOptions,
): Promise<T> => {
  for (let attempt = 0; attempt <= options.maxRetries; attempt += 1) {
    try {
      /*
       * Sequential awaits inside this loop are intentional (each retry
       * waits for the previous attempt to settle and for the backoff
       * window to elapse before starting the next one). Disable the
       * rule for the whole body so the intent is explicit.
       */
      // eslint-disable-next-line no-await-in-loop -- sequential retry
      return await operation()
    } catch (error) {
      if (attempt >= options.maxRetries || !options.isRetryable(error)) {
        throw error
      }
      const delayMs = computeDelay(attempt, options)
      options.onRetry?.(attempt + 1, error, delayMs)
      // eslint-disable-next-line no-await-in-loop -- sequential retry
      await sleep(delayMs)
    }
  }
  /* v8 ignore next -- unreachable: loop always exits via return or throw */
  throw new Error('withRetryBackoff: unreachable')
}
