import { Temporal } from '../temporal.ts'
import { SECONDS_PER_MINUTE } from '../time-units.ts'

/**
 * Subset of `Temporal.Duration` field values accepted by
 * {@link RateLimitGate}'s fallback configuration. Matches what callers
 * actually need to express a rate-limit pause window.
 */
export interface RateLimitDurationLike {
  readonly days?: number
  readonly hours?: number
  readonly minutes?: number
  readonly seconds?: number
}

const pluralize = (count: number, unit: string): string =>
  count === 1 ? unit : `${unit}s`

const parseDeltaSeconds = (seconds: number): Temporal.Duration | null =>
  Number.isFinite(seconds) && seconds > 0 ?
    Temporal.Duration.from({ seconds })
  : null

const parseHttpDate = (
  value: string,
  now: Temporal.Instant,
): Temporal.Instant | null => {
  // eslint-disable-next-line unicorn/prefer-temporal -- `Retry-After` HTTP-dates (IMF-fixdate) are not parsable by Temporal; `Date.parse` is the platform parser for them.
  const dateMs = Date.parse(value)
  if (Number.isNaN(dateMs) || dateMs <= now.epochMilliseconds) {
    return null
  }
  return Temporal.Instant.fromEpochMilliseconds(dateMs)
}

// Resolve an RFC 9110 `Retry-After` value into the absolute unblock
// instant. Delta-seconds is tried first; an HTTP-date (IMF-fixdate,
// handled by `Date.parse`) maps to that date directly. Every branch is
// anchored on the caller's single `now` capture so the unblock time
// cannot drift across separate clock reads. Returns `null` for
// unparsable, zero, negative, or past-dated values so the caller can
// apply its fallback window.
const parseRetryAfter = (
  value: unknown,
  now: Temporal.Instant,
): Temporal.Instant | null => {
  if (typeof value === 'number') {
    const delta = parseDeltaSeconds(value)
    return delta === null ? null : now.add(delta)
  }
  if (typeof value !== 'string') {
    return null
  }
  const seconds = Number(value)
  if (Number.isFinite(seconds)) {
    const delta = parseDeltaSeconds(seconds)
    return delta === null ? null : now.add(delta)
  }
  return parseHttpDate(value, now)
}

/**
 * Render a `Temporal.Duration` in English diagnostic form, with
 * adaptive units: sub-minute windows render as seconds (e.g.
 * `"20 seconds"`) so a short Retry-After never rounds to a misleading
 * `"0 minutes"`; longer windows render as `"M minutes, S seconds"`.
 *
 * Intended for log lines and developer-facing error messages — **not**
 * for presentation in a localized UI. Consumers that need localized
 * output should read the underlying `Temporal.Duration` and format it
 * with `Intl.DurationFormat` or their own i18n framework.
 * @param duration - The duration to render.
 * @returns The formatted, English-diagnostic string.
 */
export const formatDurationHuman = (duration: Temporal.Duration): string => {
  const totalSeconds = Math.trunc(duration.total({ unit: 'seconds' }))
  if (totalSeconds < SECONDS_PER_MINUTE) {
    return `${String(totalSeconds)} ${pluralize(totalSeconds, 'second')}`
  }
  const minutes = Math.trunc(totalSeconds / SECONDS_PER_MINUTE)
  const seconds = totalSeconds % SECONDS_PER_MINUTE
  if (seconds === 0) {
    return `${String(minutes)} ${pluralize(minutes, 'minute')}`
  }
  return `${String(minutes)} ${pluralize(minutes, 'minute')}, ${String(seconds)} ${pluralize(seconds, 'second')}`
}

/**
 * Tracks an upstream rate-limit window and lets callers check whether
 * the gate is currently closed.
 *
 * Used by both API clients to honor HTTP 429 responses: record the
 * rate-limit on the error path (respecting `Retry-After` when present)
 * and consult `isPaused` / `remaining` on the request path to fail fast
 * without hammering the upstream server.
 */
export class RateLimitGate {
  /**
   * Whether the gate is currently closed (caller should not make requests).
   * @returns `true` while the rate-limit window is active.
   */
  public get isPaused(): boolean {
    return (
      Temporal.Instant.compare(this.#pausedUntil, Temporal.Now.instant()) > 0
    )
  }

  /**
   * Duration remaining until the gate re-opens.
   * @returns A `Temporal.Duration` if paused, or `null` if the gate is open.
   */
  public get remaining(): Temporal.Duration | null {
    const now = Temporal.Now.instant()
    return Temporal.Instant.compare(this.#pausedUntil, now) > 0 ?
        this.#pausedUntil.since(now)
      : null
  }

  /**
   * Absolute moment at which the gate re-opens. Use alongside
   * {@link remaining} when consumers want to render an "at HH:MM"
   * message rather than a relative duration.
   *
   * Callers that need both `remaining` and `unblockAt` together should
   * prefer {@link snapshot} to avoid reading each against a separate
   * `Temporal.Now.instant()` tick (near the window boundary the pair
   * can otherwise land on different sides of `isPaused`).
   * @returns The unblock `Temporal.Instant` if paused, or `null` if the gate is open.
   */
  public get unblockAt(): Temporal.Instant | null {
    return this.isPaused ? this.#pausedUntil : null
  }

  readonly #fallback: Temporal.Duration

  #pausedUntil: Temporal.Instant = Temporal.Now.instant()

  /**
   * @param fallback - Duration to pause when the server doesn't provide
   *   a usable `Retry-After` header.
   */
  public constructor(fallback: RateLimitDurationLike) {
    this.#fallback = Temporal.Duration.from(fallback)
  }

  /**
   * Convenience: record the rate-limit and emit a formatted error log
   * in one call. Centralizes the log message format so both API clients
   * stay consistent, and avoids repeating the `recordRateLimit(...)`
   * + `logger.error(...)` pair at each 429 call site.
   * @param logger - Logger used to emit the error line.
   * @param logger.error - Error-level log sink.
   * @param retryAfter - Header value from the 429 response (delta-seconds or HTTP-date).
   * @param label - Short noun describing what was rate-limited
   *   (e.g. `'list operations'`, `''` for a generic "pausing for ..." line).
   */
  public recordAndLog(
    logger: { error: (...data: unknown[]) => void },
    retryAfter: unknown,
    label = '',
  ): void {
    this.recordRateLimit(retryAfter)
    // `recordRateLimit` always advances `#pausedUntil` into the future,
    // so the remaining duration is positive and well-defined here.
    const duration = this.#pausedUntil.since(Temporal.Now.instant())
    const suffix = label === '' ? '' : ` ${label}`
    logger.error(
      `Rate limited (429): pausing${suffix} for ${formatDurationHuman(duration)}`,
    )
  }

  /**
   * Record a rate-limit response from upstream.
   *
   * Accepts the raw `Retry-After` header value in either RFC 9110
   * form: delta-seconds (`"120"`) or an HTTP-date
   * (`"Wed, 21 Oct 2026 07:28:00 GMT"`). Unparsable, zero, negative,
   * past-dated, or missing values fall back to the configured duration.
   * @param retryAfter - Header value from the 429 response.
   */
  public recordRateLimit(retryAfter?: unknown): void {
    const now = Temporal.Now.instant()
    this.#pausedUntil =
      parseRetryAfter(retryAfter, now) ?? now.add(this.#fallback)
  }

  /** Reset the gate immediately (testing or manual unblock). */
  public reset(): void {
    this.#pausedUntil = Temporal.Now.instant()
  }

  /**
   * Atomic read of the gate's state. All fields are computed against a
   * single `Temporal.Now.instant()` capture, so `remaining` and
   * `unblockAt` cannot observe inconsistent "one null, one not" pairs
   * that separate getter reads might hit near the boundary.
   *
   * Returned as a discriminated union on `isPaused` so callers do not
   * need to null-check `remaining` / `unblockAt` after narrowing.
   * @returns The current pause state and derived timing fields.
   */
  public snapshot():
    | { isPaused: false; remaining: null; unblockAt: null }
    | {
        isPaused: true
        remaining: Temporal.Duration
        unblockAt: Temporal.Instant
      } {
    const now = Temporal.Now.instant()
    if (Temporal.Instant.compare(this.#pausedUntil, now) <= 0) {
      return { isPaused: false, remaining: null, unblockAt: null }
    }
    return {
      isPaused: true,
      remaining: this.#pausedUntil.since(now),
      unblockAt: this.#pausedUntil,
    }
  }
}
