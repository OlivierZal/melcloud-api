import { Temporal } from 'temporal-polyfill'

import { SECONDS_PER_MINUTE } from '../time-units.ts'

const pluralise = (value: number, unit: string): string =>
  `${String(value)} ${unit}${value === 1 ? '' : 's'}`

const formatSeconds = (totalSeconds: number): string => {
  if (totalSeconds < SECONDS_PER_MINUTE) {
    return pluralise(totalSeconds, 'second')
  }
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE)
  const seconds = totalSeconds % SECONDS_PER_MINUTE
  if (seconds === 0) {
    return pluralise(minutes, 'minute')
  }
  return `${pluralise(minutes, 'minute')}, ${pluralise(seconds, 'second')}`
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
    return this.isPaused ?
        this.#pausedUntil.since(Temporal.Now.instant())
      : null
  }

  /**
   * Absolute moment at which the gate re-opens. Pair with `remaining` only via
   * {@link snapshot} — separate getter reads sample `Now` independently and can
   * land on opposite sides of the window boundary.
   * @returns The unblock `Temporal.Instant` if paused, or `null`.
   */
  public get unblockAt(): Temporal.Instant | null {
    return this.isPaused ? this.#pausedUntil : null
  }

  readonly #fallback: Temporal.Duration

  #pausedUntil: Temporal.Instant = Temporal.Now.instant()

  /**
   * @param fallback - Time-only duration (`hours`, `minutes`, `seconds`,
   *   `milliseconds`) to pause when the server doesn't provide a usable
   *   `Retry-After` header. Calendar units are rejected by `Instant.add`
   *   at runtime since they require a calendar context an Instant doesn't carry.
   */
  public constructor(fallback: Temporal.DurationLike) {
    this.#fallback = Temporal.Duration.from(fallback)
  }

  /**
   * Human-readable remaining time, English only (was localised via Luxon's
   * `toHuman()`; Temporal has no built-in equivalent until `Intl.DurationFormat`
   * lands natively). Short windows in seconds, longer in `M minutes, S seconds`.
   * Empty string when the gate is open.
   * @returns Formatted remaining duration, or `''` if open.
   */
  public formatRemaining(): string {
    const { remaining } = this
    if (remaining === null) {
      return ''
    }
    return formatSeconds(Math.round(remaining.total({ unit: 'seconds' })))
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
    const suffix = label === '' ? '' : ` ${label}`
    logger.error(
      `Rate limited (429): pausing${suffix} for ${this.formatRemaining()}`,
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
    const duration: Temporal.Duration | Temporal.DurationLike =
      Number.isFinite(seconds) && seconds > 0 ? { seconds } : this.#fallback
    this.#pausedUntil = Temporal.Now.instant().add(duration)
  }

  /** Reset the gate immediately (testing or manual unblock). */
  public reset(): void {
    this.#pausedUntil = Temporal.Now.instant()
  }

  /**
   * Atomic read of the gate's state. All three fields share a single
   * `Now.instant()` capture, so `remaining` and `unblockAt` can't observe
   * inconsistent "one null, one not" pairs near the window boundary.
   * @returns The current pause state and derived timing fields.
   */
  public snapshot(): {
    isPaused: boolean
    remaining: Temporal.Duration | null
    unblockAt: Temporal.Instant | null
  } {
    const now = Temporal.Now.instant()
    const isPaused = Temporal.Instant.compare(this.#pausedUntil, now) > 0
    return {
      isPaused,
      remaining: isPaused ? this.#pausedUntil.since(now) : null,
      unblockAt: isPaused ? this.#pausedUntil : null,
    }
  }
}
