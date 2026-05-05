import { DateTime } from 'luxon'

/**
 * Check whether an ISO 8601 expiry timestamp has passed or is malformed.
 *
 * Semantics:
 * - Empty string → `false` (no expiry recorded yet, e.g. fresh instance)
 * - Unparseable value → `true` (defensive: corruption is treated as expired
 *   so the caller reauthenticates instead of silently trusting stale state)
 * - Valid ISO date in the past → `true`
 * - Valid ISO date in the future → `false` (subject to `aheadMs` below)
 *
 * Pre-emptive refresh: pass `aheadMs > 0` to treat a token as expired
 * while it still has that much lifetime left. This lets `ensureSession`
 * renew the session **before** the real expiry tick, so no request
 * ever pays the full re-auth round-trip in its critical path. The
 * common value is 5 minutes (`5 * 60 * 1000`).
 *
 * Uses Luxon `DateTime.fromISO` (not native `Date.parse`) so that ISO
 * strings without an explicit timezone offset — the format the MELCloud
 * Classic server actually returns in `ClassicLoginData.Expiry` — are
 * interpreted in the caller-supplied `zone`. Classic passes its
 * configured `ClassicAPIConfig.timezone`, Home passes `'utc'` (the
 * `/connect/token` flow stamps `expires_in` against UTC). Native
 * parsing would anchor on the host runtime timezone, shifting the
 * comparison by hours when the deployment timezone differs from the
 * host (e.g. UTC CI runner, Docker container).
 * @param expiry - ISO 8601 expiry timestamp (or empty string).
 * @param aheadMs - Consider the session expired `aheadMs` milliseconds
 * before its real expiry (default 0 = real expiry).
 * @param zone - IANA timezone identifier used to interpret offset-less
 * ISO strings. When `undefined`, falls back to `'local'` (the host's
 * system zone) so the result is independent of any process-global
 * `Settings.defaultZone` state another module might mutate.
 * @returns `true` if the expiry is past (or within `aheadMs`) or cannot be parsed, `false` otherwise.
 */
export const isSessionExpired = (
  expiry: string,
  aheadMs = 0,
  zone?: string,
): boolean => {
  if (expiry === '') {
    return false
  }
  const parsed = DateTime.fromISO(expiry, { zone: zone ?? 'local' })
  if (!parsed.isValid) {
    return true
  }
  const threshold = DateTime.now().plus({ milliseconds: aheadMs })
  return parsed < threshold
}
