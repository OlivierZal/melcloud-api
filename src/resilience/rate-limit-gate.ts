import { type DurationLike, DateTime, Duration } from 'luxon'

const SECONDS_PER_MINUTE = 60

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
  readonly #fallback: Duration

  #pausedUntil: DateTime = DateTime.now()

  /**
   * @param fallback - Duration to pause when the server doesn't provide
   *   a usable `Retry-After` header.
   */
  public constructor(fallback: DurationLike) {
    this.#fallback = Duration.fromDurationLike(fallback)
  }

  /**
   * Whether the gate is currently closed (caller should not make requests).
   * @returns `true` while the rate-limit window is active.
   */
  public get isPaused(): boolean {
    return this.#pausedUntil > DateTime.now()
  }

  /**
   * Duration remaining until the gate re-opens.
   * @returns A Luxon Duration if paused, or `null` if the gate is open.
   */
  public get remaining(): Duration | null {
    return this.isPaused ? this.#pausedUntil.diffNow() : null
  }

  /**
   * Human-readable remaining time with adaptive units. For short windows
   * (< 1 minute) the output is in seconds (e.g. "20 seconds") so a short
   * Retry-After doesn't get rounded into a misleading "0 minutes".
   * Longer windows use minutes + seconds (e.g. "2 minutes, 15 seconds").
   * Returns an empty string when the gate is open — callers can
   * interpolate directly into log lines without checking `isPaused` first.
   * @returns Formatted remaining duration, or `''` if the gate is open.
   */
  public formatRemaining(): string {
    const { remaining } = this
    if (remaining === null) {
      return ''
    }
    return remaining.as('seconds') < SECONDS_PER_MINUTE ?
        remaining.shiftTo('seconds').toHuman()
      : remaining.shiftTo('minutes', 'seconds').rescale().toHuman()
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
      Number.isFinite(seconds) && seconds > 0 ? { seconds } : this.#fallback
    this.#pausedUntil = DateTime.now().plus(duration)
  }

  /** Reset the gate immediately (testing or manual unblock). */
  public reset(): void {
    this.#pausedUntil = DateTime.now()
  }
}
