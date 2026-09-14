/**
 * Resilience primitives — the mechanisms live in `@olivierzal/api-core`
 * (shared with heatzy-api), and since 55.1.0 the pipeline that
 * composes them (the rate-limit gate outermost, the guarded 401
 * replay, the GET-only transient retry, with `ensureSession()` as the
 * lifecycle entry ahead of them all) is assembled inside the core's
 * `SessionAPI` around every request — no composition contract lives in
 * this repo any more. This barrel forwards only the primitives the
 * MELCloud layer still names:
 *
 * - {@link RateLimitGate}: the type `BaseAPI` narrows its inherited
 *   gate to for the `isRateLimited` surface.
 * - {@link RetryGuard}: named by the session-lifecycle kernel's
 *   guarded-replay clauses.
 * - {@link isSessionExpired}: the pre-emptive expiry check both
 *   dialect `ensureSession` hooks run (Classic threads
 *   `ClassicAPIConfig.timezone` through its optional IANA `zone`
 *   parameter).
 */
export {
  isSessionExpired,
  RateLimitGate,
  RetryGuard,
} from '@olivierzal/api-core'
