/**
 * Resilience primitives shared by both API clients.
 *
 * Composition contract (how these pieces interact inside
 * `BaseAPI.request`):
 *
 * 1. **`ensureSession()`** runs first. If the session is missing or
 *    expired, the subclass re-authenticates before the request leaves
 *    the method. Not part of this module, but the entry point callers
 *    rely on.
 * 2. **`RateLimitGate`** throws {@link RateLimitError} synchronously
 *    when a `429 Retry-After` window is still active. Short-circuits
 *    before any network I/O; consumers must treat the gate as a
 *    circuit breaker, not a throttle.
 * 3. **`withRetryBackoff`** (driven by
 *    {@link DEFAULT_TRANSIENT_RETRY_OPTIONS} +
 *    {@link isTransientServerError}) wraps **GET** requests only:
 *    non-idempotent verbs bail on the first failure to avoid silent
 *    duplicate writes. Retries a bounded number of transient 5xx
 *    errors with exponential backoff.
 * 4. **401 retry-auth** runs after backoff gives up: the shared
 *    `BaseAPI.makeRequestAttempt` catches a persistent 401, consumes
 *    a {@link RetryGuard} token (one chance per `retryDelay` window),
 *    calls the subclass `retryAuth()` hook (token refresh → re-auth),
 *    and replays the original request once. The guard prevents
 *    infinite loops when the rejected credential keeps being rejected.
 * 5. **`DisposableTimeout`** is orthogonal to the above — a timer
 *    primitive used by `SyncManager` for auto-sync scheduling; it
 *    does not participate in the per-request pipeline.
 *
 * Order matters: rate-limit first (cheap, synchronous, refuses new
 * work immediately), then retry-backoff (expensive, async),
 * then retry-auth (needs a 401 after backoff has given up). Each
 * stage swallows only the error class it owns — unrelated errors
 * propagate unchanged.
 */
export { DisposableTimeout } from './disposable-timeout.ts'
export { RateLimitGate } from './rate-limit-gate.ts'
export {
  type RetryBackoffOptions,
  DEFAULT_TRANSIENT_RETRY_OPTIONS,
  isTransientServerError,
  withRetryBackoff,
} from './retry-backoff.ts'
export { RetryGuard } from './retry-guard.ts'
export { isSessionExpired } from './session-expiry.ts'
export {
  APIError,
  AuthenticationError,
  isAPIError,
  NetworkError,
  RateLimitError,
} from '../errors/index.ts'
export {
  toClassicAreaId,
  toClassicBuildingId,
  toClassicDeviceId,
  toClassicFloorId,
} from '../types/ids.ts'
