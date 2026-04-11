/**
 * Check whether an ISO 8601 expiry timestamp has passed or is malformed.
 *
 * Semantics:
 * - Empty string → `false` (no expiry recorded yet, e.g. fresh instance)
 * - Unparseable value → `true` (defensive: corruption is treated as expired
 *   so the caller reauthenticates instead of silently trusting stale state)
 * - Valid ISO date in the past → `true`
 * - Valid ISO date in the future → `false`
 * @param expiry - ISO 8601 expiry timestamp (or empty string).
 * @returns `true` if the expiry is past or cannot be parsed, `false` otherwise.
 */
export const isSessionExpired = (expiry: string): boolean => {
  if (expiry === '') {
    return false
  }
  const timestamp = Date.parse(expiry)
  return Number.isNaN(timestamp) || timestamp < Date.now()
}
