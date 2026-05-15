import { Temporal } from '../temporal.ts'

// Detects an explicit UTC marker (`Z`) or numeric offset (`±HH:MM` /
// `±HHMM`) after the date/time separator. Offset-less inputs need
// zone-aware parsing; offset-bearing inputs are absolute instants.
const OFFSET_REGEX = /[+-]\d{2}:?\d{2}$/u

const hasOffset = (iso: string): boolean => {
  if (!iso.includes('T')) {
    return false
  }
  const afterT = iso.slice(iso.indexOf('T') + 1)
  return afterT.includes('Z') || OFFSET_REGEX.test(afterT)
}

const parseToInstant = (
  expiry: string,
  zone: string | undefined,
): Temporal.Instant | null => {
  try {
    if (hasOffset(expiry)) {
      return Temporal.Instant.from(expiry)
    }
    const pdt = Temporal.PlainDateTime.from(expiry)
    return pdt.toZonedDateTime(zone ?? Temporal.Now.timeZoneId()).toInstant()
  } catch {
    return null
  }
}

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
 * Offset-less ISO strings — the format the MELCloud Classic server
 * returns in `ClassicLoginData.Expiry` — are interpreted in the
 * supplied `zone` (Classic configures this from
 * `ClassicAPIConfig.timezone`). Without a zone, the runtime's system
 * timezone is used. Strings with an explicit `Z` or `±HH:MM` offset
 * are parsed as absolute `Temporal.Instant`s, ignoring `zone`.
 * @param expiry - ISO 8601 expiry timestamp (or empty string).
 * @param aheadMs - Consider the session expired `aheadMs` milliseconds
 * before its real expiry (default 0 = real expiry).
 * @param zone - IANA timezone for offset-less inputs; defaults to the
 * runtime system zone.
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
  const parsed = parseToInstant(expiry, zone)
  if (parsed === null) {
    return true
  }
  const threshold = Temporal.Now.instant().add({ milliseconds: aheadMs })
  return Temporal.Instant.compare(parsed, threshold) < 0
}
