/**
 * Resilience primitives shared by both API clients.
 *
 * Composition contract (how these pieces interact inside
 * `BaseAPI.request`):
 *
 * 1. **`ensureSession()`** runs first. If the session is missing or
 *    expired (with pre-emptive threshold), the subclass
 *    re-authenticates before the request leaves the method. Not part
 *    of the resilience chain — it's the lifecycle entry that
 *    guarantees we have valid credentials to even try.
 * 2. **{@link ResiliencePolicy}** chain — assembled via
 *    {@link CompositePolicy} with outer → inner order:
 *    - {@link RateLimitPolicy} (outermost): short-circuits with
 *      {@link RateLimitError} if the gate is paused; records a 429
 *      response into the gate on the way out.
 *    - {@link AuthRetryPolicy} (middle): on 401, consume a
 *      {@link RetryGuard} token, reauthenticate via the
 *      subclass-provided hook, replay exactly once.
 *    - {@link TransientRetryPolicy} (innermost, GET-only): retries
 *      `502/503/504` via {@link withRetryBackoff} with exponential
 *      backoff.
 * 3. **`DisposableTimeout`** is orthogonal — a timer primitive used
 *    by `SyncManager` for auto-sync scheduling; it does not
 *    participate in the per-request pipeline.
 *
 * Each policy owns exactly one concern and propagates anything
 * outside it, so the composition is deterministic and each stage is
 * testable in isolation.
 */
export { AuthRetryPolicy } from './auth-retry-policy.ts'
export { DisposableTimeout } from './disposable-timeout.ts'
export { type ResiliencePolicy, CompositePolicy } from './policy.ts'
export { RateLimitGate } from './rate-limit-gate.ts'
export { RateLimitPolicy } from './rate-limit-policy.ts'
export {
  type RetryBackoffOptions,
  DEFAULT_TRANSIENT_RETRY_OPTIONS,
  isTransientServerError,
  withRetryBackoff,
} from './retry-backoff.ts'
export { RetryGuard } from './retry-guard.ts'
export { isSessionExpired } from './session-expiry.ts'
export {
  type RetryTelemetry,
  TransientRetryPolicy,
} from './transient-retry-policy.ts'
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
