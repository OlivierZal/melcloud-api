import type { Duration } from 'luxon'

import { MelCloudError } from './base.ts'

/**
 * Upstream returned HTTP 429 (Too Many Requests), or the local
 * rate-limit gate is still holding a pause window from a previous 429.
 */
export class RateLimitError extends MelCloudError {
  public override readonly name = 'RateLimitError'

  public readonly retryAfter: Duration | null

  public constructor(
    message: string,
    options: { retryAfter: Duration | null; cause?: unknown },
  ) {
    const { cause, retryAfter } = options
    super(message, { cause })
    this.retryAfter = retryAfter
  }
}
