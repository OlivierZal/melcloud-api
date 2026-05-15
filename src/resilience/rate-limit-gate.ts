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
   * @param retryAfterSeconds - Header value from the 429 response.
   * @param label - Short noun describing what was rate-limited
   *   (e.g. `'list operations'`, `''` for a generic "pausing for ..." line).
   */
  public recordAndLog(
    logger: { error: (...data: unknown[]) => void },
    retryAfterSeconds: unknown,
    label = '',
  ): void {
    this.recordRateLimit(retryAfterSeconds)
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
   * Accepts the raw `Retry-After` header value (seconds). Non-numeric,
   * zero, negative, or missing values fall back to the configured duration.
   * @param retryAfterSeconds - Header value from the 429 response.
   */
  public recordRateLimit(retryAfterSeconds?: unknown): void {
    const seconds = Number(retryAfterSeconds)
    const duration =
      Number.isFinite(seconds) && seconds > 0 ?
        Temporal.Duration.from({ seconds })
      : this.#fallback
    this.#pausedUntil = Temporal.Now.instant().add(duration)
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
