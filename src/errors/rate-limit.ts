import type { DateTime, Duration } from 'luxon'

import { APIError } from './base.ts'

/**
 * Upstream returned HTTP 429 (Too Many Requests), or the local
 * rate-limit gate is still holding a pause window from a previous 429.
 *
 * Consumers receive structured, machine-readable fields so they can
 * format their own localized messages without parsing the string:
 * - {@link retryAfter}: relative duration remaining (ideal for
 *   "try again in 5 min" phrasing).
 * - {@link unblockAt}: absolute unblock time (ideal for
 *   "try again at 14:30" phrasing).
 */
export class RateLimitError extends APIError {
  public override readonly name = 'RateLimitError'

  public readonly retryAfter: Duration | null

  public readonly unblockAt: DateTime | null

  public constructor(
    message: string,
    options: {
      retryAfter: Duration | null
      unblockAt: DateTime | null
      cause?: unknown
    },
  ) {
    const { cause, retryAfter, unblockAt } = options
    super(message, { cause })
    this.retryAfter = retryAfter
    this.unblockAt = unblockAt
  }
}
