import { DateTime } from 'luxon'

/**
 * Check whether an ISO 8601 expiry timestamp has passed or is malformed.
 *
 * Semantics:
 * - Empty string → `false` (no expiry recorded yet, e.g. fresh instance)
 * - Unparseable value → `true` (defensive: corruption is treated as expired
 *   so the caller reauthenticates instead of silently trusting stale state)
 * - Valid ISO date in the past → `true`
 * - Valid ISO date in the future → `false`
 *
 * Uses Luxon `DateTime.fromISO` (not native `Date.parse`) so that ISO
 * strings without an explicit timezone offset — the format the MELCloud
 * Classic server actually returns in `LoginData.Expiry` — are interpreted
 * in `LuxonSettings.defaultZone`, which Classic configures from
 * `APIConfig.timezone`. Native parsing would anchor on the host runtime
 * timezone, shifting the comparison by hours when the deployment timezone
 * differs from the host (e.g. UTC CI runner, Docker container).
 * @param expiry - ISO 8601 expiry timestamp (or empty string).
 * @returns `true` if the expiry is past or cannot be parsed, `false` otherwise.
 */
export const isSessionExpired = (expiry: string): boolean => {
  if (expiry === '') {
    return false
  }
  const parsed = DateTime.fromISO(expiry)
  return !parsed.isValid || parsed < DateTime.now()
}
