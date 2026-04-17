/**
 * Resilience primitives shared by both API clients. Re-exports the
 * low-level helpers used to build auth, retry, rate-limit, and session
 * expiry handling so consumers (`classic.ts`, `home.ts`) only need
 * one import rather than four.
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
