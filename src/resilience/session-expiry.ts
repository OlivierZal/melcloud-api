import { DateTime } from 'luxon'

/**
 * Whether an ISO 8601 expiry has passed (or is unparseable).
 *
 * Empty string → `false` (no expiry recorded). Malformed → `true`
 * (defensive: forces re-auth rather than trusting stale state). Pass
 * `aheadMs > 0` for pre-emptive refresh.
 *
 * `zone` interprets offset-less ISO strings — Classic's `Expiry`
 * field has no offset, so the host TZ would otherwise shift the
 * comparison. Home's tokens are `Z`-suffixed and `zone` is honoured
 * but redundant.
 * @param expiry - ISO 8601 timestamp (or empty string).
 * @param aheadMs - Pre-empt expiry by this many milliseconds.
 * @param zone - Luxon zone (IANA, `'utc'`, `'local'`, fixed offset). Defaults to system zone.
 * @returns `true` if past (or within `aheadMs`) or unparseable.
 */
export const isSessionExpired = (
  expiry: string,
  aheadMs = 0,
  zone?: string,
): boolean => {
  if (expiry === '') {
    return false
  }
  const parsed = DateTime.fromISO(expiry, { zone })
  if (!parsed.isValid) {
    return true
  }
  const threshold = DateTime.now().plus({ milliseconds: aheadMs })
  return parsed < threshold
}
