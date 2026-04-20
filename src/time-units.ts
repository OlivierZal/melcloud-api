/**
 * Shared time unit constants. Single source of truth so callers don't
 * recompute (or worse, redefine with subtly different names like
 * `MILLISECONDS_IN_SECOND` vs `MILLISECONDS_PER_SECOND`).
 */

/** Number of seconds in one minute. */
export const SECONDS_PER_MINUTE = 60
/** Number of milliseconds in one second. */
export const MS_PER_SECOND = 1000
/** Number of milliseconds in one minute. */
export const MS_PER_MINUTE = 60_000
/** Number of milliseconds in one hour. */
export const MS_PER_HOUR = 3_600_000
