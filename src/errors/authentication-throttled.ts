import type { Temporal } from '../temporal.ts'
import { AuthenticationError } from './authentication.ts'

/**
 * MELCloud is temporarily refusing sign-ins (login throttle): Classic
 * reports it as `ErrorId 6` on `ClientLogin3`, Home as HTTP 429 from
 * the token endpoints. Retrying a login keeps the lockout alive, so the
 * automatic re-login backoff widens when this error arms it; sessions
 * established BEFORE the throttle keep working (MELCloud stays generous
 * with existing keys).
 *
 * `retryAfter` carries the window the server itself announced — Classic
 * counts it down in `LoginMinutes` — mirroring `RateLimitError`'s field
 * so a consumer can say "try again in N minutes" without parsing the
 * message. It is `null` when the upstream announced none, which is what
 * makes the caller fall back to its own conservative pause.
 * @category Errors
 */
export class AuthenticationThrottledError extends AuthenticationError {
  public override readonly name = 'AuthenticationThrottledError'

  public readonly retryAfter: Temporal.Duration | null

  /**
   * Builds the error from the message and the announced window.
   * @param message - Human-readable error description.
   * @param options - Throttle window metadata plus optional cause.
   * @param options.retryAfter - `Temporal.Duration` the server asks the
   * caller to wait, or `null` when it announced none.
   * @param options.cause - Original error that triggered this one.
   */
  public constructor(
    message: string,
    options: { retryAfter: Temporal.Duration | null; cause?: unknown },
  ) {
    const { retryAfter } = options
    super(message, options)
    this.retryAfter = retryAfter
  }
}
