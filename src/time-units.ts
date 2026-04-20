/**
 * Shared time unit constants. Single source of truth so callers don't
 * recompute (or worse, redefine with subtly different names like
 * `MILLISECONDS_IN_SECOND` vs `MILLISECONDS_PER_SECOND`).
 */

export const SECONDS_PER_MINUTE = 60
export const MS_PER_SECOND = 1000
export const MS_PER_MINUTE = 60_000
export const MS_PER_HOUR = 3_600_000
