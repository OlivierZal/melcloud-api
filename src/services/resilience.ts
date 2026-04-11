/**
 * Resilience primitives shared by both API clients. Re-exports the
 * low-level helpers used to build auth, retry, rate-limit, and session
 * expiry handling so consumers (`api.ts`, `home-api.ts`) only need one
 * import rather than four.
 */
export { RateLimitGate } from './rate-limit-gate.ts'
export {
  type RetryBackoffOptions,
  isTransientServerError,
  withRetryBackoff,
} from './retry-backoff.ts'
export { RetryGuard } from './retry-guard.ts'
export { isSessionExpired } from './session-expiry.ts'
