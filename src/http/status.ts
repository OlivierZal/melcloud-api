/**
 * HTTP status codes used across the SDK. Single source so callers
 * don't redefine them per file (`HTTP_STATUS_UNAUTHORIZED` was
 * declared in three places before this module existed).
 *
 * Restricted to the codes the SDK actually branches on — adding more
 * here without a real call site is dead weight.
 */

export const HTTP_STATUS_UNAUTHORIZED = 401
export const HTTP_STATUS_TOO_MANY_REQUESTS = 429
export const HTTP_STATUS_BAD_GATEWAY = 502
export const HTTP_STATUS_SERVICE_UNAVAILABLE = 503
export const HTTP_STATUS_GATEWAY_TIMEOUT = 504
