import type { Temporal } from 'temporal-polyfill'

import { APIError } from './base.ts'

/**
 * Upstream returned HTTP 429, or the local rate-limit gate is still holding
 * a pause window from a previous 429. Exposes structured fields so consumers
 * format their own localized messages: {@link retryAfter} for "try again in
 * 5 min" phrasing, {@link unblockAt} for "try again at 14:30".
 * @category Errors
 */
export class RateLimitError extends APIError {
  public override readonly name = 'RateLimitError'

  public readonly retryAfter: Temporal.Duration | null

  public readonly unblockAt: Temporal.Instant | null

  /**
   * Build a `RateLimitError` from the message and rate-limit window
   * metadata. Both `retryAfter` and `unblockAt` may be `null` when the
   * upstream supplies no window.
   * @param message - Human-readable error description.
   * @param options - Rate-limit window metadata plus optional cause.
   * @param options.retryAfter - Duration until retry is allowed, or `null`.
   * @param options.unblockAt - Absolute unblock time, or `null`.
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
