/* eslint-disable max-classes-per-file -- tightly coupled error hierarchy */
import type { Duration } from 'luxon'

/**
 * Base class for all errors thrown by this SDK.
 *
 * Consumers can use `instanceof MelCloudError` as a coarse filter
 * distinguishing SDK-emitted failures from other runtime errors, and
 * `instanceof` with the more specific subclasses
 * ({@link AuthenticationError}, {@link RateLimitError},
 * {@link TransientServerError}, {@link NetworkError}) to branch on
 * the failure category.
 *
 * Every SDK error preserves the original rejection as `cause` when
 * available, allowing consumers to walk down to the raw axios error if
 * they need status codes, response headers, or config details.
 */
export abstract class MelCloudError extends Error {
  public override readonly name: string = 'MelCloudError'

  public constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
  }
}

/**
 * The server rejected the credentials, the login form could not be
 * parsed, or the reactive re-authentication after a 401 failed.
 *
 * Thrown by `authenticate()` when explicit credentials are provided.
 * Not thrown by the stored-credentials auto-login path — that path
 * still logs and returns `false` (see the `@authenticate` decorator)
 * so fresh-instance creation doesn't surface transient auth issues
 * as unhandled rejections.
 */
export class AuthenticationError extends MelCloudError {
  public override readonly name = 'AuthenticationError'
}

/**
 * Upstream returned HTTP 429 (Too Many Requests), or the local
 * {@link RateLimitGate} is still holding a pause window from a
 * previous 429. Subsequent calls should wait until {@link retryAfter}
 * elapses before retrying.
 */
export class RateLimitError extends MelCloudError {
  public override readonly name = 'RateLimitError'

  /**
   * Remaining duration before the gate re-opens, when known. `null`
   * when the SDK falls back to a default pause window without a usable
   * `Retry-After` header.
   */
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

/**
 * A transient HTTP 5xx error (502 / 503 / 504) the retry budget
 * couldn't recover from. The upstream service was available enough to
 * respond, but not healthy enough to serve the request even after
 * several backoff attempts.
 *
 * In practice the heartbeat paths (`fetch()` / `list()`) swallow this
 * and return empty arrays, but methods that surface errors to their
 * callers (e.g. `getErrorLog`, direct `authenticate`) will throw this
 * subclass so consumers can differentiate it from a permanent failure.
 */
export class TransientServerError extends MelCloudError {
  public override readonly name = 'TransientServerError'
}

/**
 * A network-level error: the request never received an HTTP response.
 *
 * Typical causes: DNS failure, TCP connection refused, TLS handshake
 * failure, request timeout (axios `ECONNABORTED` / `ETIMEDOUT`), or a
 * network interruption mid-request. Consumers commonly want to
 * display an "offline" indicator and schedule a deferred retry rather
 * than surfacing a cryptic low-level error.
 */
export class NetworkError extends MelCloudError {
  public override readonly name = 'NetworkError'
}
