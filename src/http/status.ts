/**
 * HTTP status codes used across the SDK. Single source so callers
 * don't redefine them per file (`HTTP_STATUS_UNAUTHORIZED` was
 * declared in three places before this module existed).
 *
 * Restricted to the codes the SDK actually branches on — adding more
 * here without a real call site is dead weight.
 */
export const HttpStatus = {
  /** HTTP 502 — transient upstream failure. Eligible for retry on GET. */
  BadGateway: 502,
  /** HTTP 504 — transient upstream timeout. Eligible for retry on GET. */
  GatewayTimeout: 504,
  /** HTTP 503 — transient service unavailability. Eligible for retry on GET. */
  ServiceUnavailable: 503,
  /** HTTP 429 — rate limited. Feeds into the rate-limit gate. */
  TooManyRequests: 429,
  /** HTTP 401 — authentication required or rejected. Triggers session re-auth. */
  Unauthorized: 401,
} as const

/** Union of HTTP status codes the SDK explicitly handles. */
export type HttpStatusCode = (typeof HttpStatus)[keyof typeof HttpStatus]
