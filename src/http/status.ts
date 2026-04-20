/**
 * HTTP status codes used across the SDK. Single source so callers
 * don't redefine them per file (`HTTP_STATUS_UNAUTHORIZED` was
 * declared in three places before this module existed).
 *
 * Restricted to the codes the SDK actually branches on — adding more
 * here without a real call site is dead weight.
 */

/** HTTP 401 — authentication required or rejected. Triggers session re-auth. */
export const HTTP_STATUS_UNAUTHORIZED = 401
/** HTTP 429 — rate limited. Feeds into the rate-limit gate. */
export const HTTP_STATUS_TOO_MANY_REQUESTS = 429
/** HTTP 502 — transient upstream failure. Eligible for retry on GET. */
export const HTTP_STATUS_BAD_GATEWAY = 502
/** HTTP 503 — transient service unavailability. Eligible for retry on GET. */
export const HTTP_STATUS_SERVICE_UNAVAILABLE = 503
/** HTTP 504 — transient upstream timeout. Eligible for retry on GET. */
export const HTTP_STATUS_GATEWAY_TIMEOUT = 504
