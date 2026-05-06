import { Temporal } from 'temporal-polyfill'

const parseExpiry = (
  expiry: string,
  zone: string | undefined,
): Temporal.Instant | null => {
  try {
    return Temporal.Instant.from(expiry)
  } catch {
    try {
      return Temporal.PlainDateTime.from(expiry)
        .toZonedDateTime(zone ?? Temporal.Now.timeZoneId())
        .toInstant()
    } catch {
      return null
    }
  }
}

/**
 * Whether an ISO 8601 expiry has passed (or is unparseable).
 *
 * Empty string → `false` (no expiry recorded). Malformed → `true`
 * (defensive: forces re-auth). Pass `aheadMs > 0` for pre-emptive refresh.
 *
 * `zone` interprets offset-less inputs (Classic's `Expiry` is offset-less).
 * Home's tokens are `Z`-suffixed and `zone` is ignored.
 * @param expiry - ISO 8601 timestamp (or empty string).
 * @param aheadMs - Pre-empt expiry by this many milliseconds.
 * @param zone - IANA zone identifier. Defaults to system zone.
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
  const parsed = parseExpiry(expiry, zone)
  if (parsed === null) {
    return true
  }
  const threshold = Temporal.Now.instant().add({ milliseconds: aheadMs })
  return Temporal.Instant.compare(parsed, threshold) < 0
}
