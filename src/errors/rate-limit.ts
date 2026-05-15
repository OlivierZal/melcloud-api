import type { Temporal } from '../temporal.ts'
import { APIError } from './base.ts'

/**
 * Upstream returned HTTP 429 (Too Many Requests), or the local
 * rate-limit gate is still holding a pause window from a previous 429.
 *
 * Consumers receive structured, machine-readable fields so they can
 * format their own localized messages without parsing the string:
 * - {@link retryAfter}: relative duration remaining (ideal for
 *   "try again in 5 min" phrasing) — read with
 *   `retryAfter.total({ unit: 'seconds' })`.
 * - {@link unblockAt}: absolute unblock time (ideal for
 *   "try again at 14:30" phrasing) — read with
 *   `unblockAt.toString()` or convert via
 *   `unblockAt.toZonedDateTimeISO(zone)`.
 * @category Errors
 */
export class RateLimitError extends APIError {
  public override readonly name = 'RateLimitError'

  public readonly retryAfter: Temporal.Duration | null

  public readonly unblockAt: Temporal.Instant | null

  /**
   * Builds the error from the message and rate-limit window metadata;
   * both `retryAfter` and `unblockAt` may be `null` when the upstream
   * supplies no window.
   * @param message - Human-readable error description.
   * @param options - Rate-limit window metadata plus optional cause.
   * @param options.retryAfter - `Temporal.Duration` until retry is allowed, or `null`.
   * @param options.unblockAt - Absolute unblock `Temporal.Instant`, or `null`.
   * @param options.cause - Original error that triggered this one.
   */
  public constructor(
    message: string,
    options: {
      retryAfter: Temporal.Duration | null
      unblockAt: Temporal.Instant | null
      cause?: unknown
    },
  ) {
    const { cause, retryAfter, unblockAt } = options
    super(message, { cause })
    this.retryAfter = retryAfter
    this.unblockAt = unblockAt
  }
}
