/**
 * Cross-dialect error-log vocabulary: the entry shape both MELCloud
 * dialects project onto, the Classic page wrapper, and the pure window
 * arithmetic a consumer needs to tile identical pages without a wire
 * call (a Home-only account pages the same windows the Classic API
 * would have answered).
 */
import { Temporal } from './temporal.ts'

/**
 * One error-log entry in the cross-dialect vocabulary. `at` and
 * `deviceId` exist on every dialect; `message` when the wire carries a
 * text (always on Classic, when a reason exists on Home); `code` and
 * `clearedAt` only where the wire has them (Home).
 * @category Facades
 */
export interface ErrorLogEntry {
  /**
   * When the error occurred (ISO 8601, as the wire reported it).
   */
  readonly at: string
  /**
   * Identifier of the device that reported the error — numeric on
   * Classic, a GUID string on Home.
   */
  readonly deviceId: number | string
  /**
   * When the error cleared (Home only, while uncleared it is absent).
   */
  readonly clearedAt?: string
  /**
   * Wire error code (Home only — the Classic wire has none).
   */
  readonly code?: string
  /**
   * Human-readable message: always present on Classic entries, only
   * when the wire carries a reason on Home.
   */
  readonly message?: string
}

/**
 * One Classic error-log page: the neutral entries plus the chained
 * window bounds driving the next page (feed `nextFromDate` and
 * `nextToDate` back as `from` and `to`). The Home wire has no window —
 * Home reads answer bare entries.
 * @category Facades
 */
export interface ErrorLogPage {
  /**
   * The page's entries, sorted in reverse chronological order.
   */
  readonly entries: readonly ErrorLogEntry[]
  /**
   * ISO date the resolved window starts on.
   */
  readonly fromDate: string
  /**
   * ISO date to feed back as `from` for the next (older) page.
   */
  readonly nextFromDate: string
  /**
   * ISO date to feed back as `to` for the next (older) page.
   */
  readonly nextToDate: string
}

/**
 * Query window of an error-log page. `from` pins the window start
 * (`offset` is then moot); otherwise pages stack backwards from `to`
 * (defaulting to today) in `period`-day windows, `offset` counting the
 * steps back.
 * @category Facades
 */
export interface ErrorLogQuery {
  /**
   * Start date in ISO 8601 format. When set, the query is pinned to
   * that window and `offset` is ignored; `period` only shapes the
   * chained next-page bounds.
   */
  readonly from?: string
  /**
   * Page offset, in `period`-sized windows: `0` (default) is the most
   * recent window, `1` the previous, etc. Pages are separated by a
   * one-day boundary so consecutive pages never overlap.
   */
  readonly offset?: number
  /**
   * Number of days per page. Defaults to `1`.
   */
  readonly period?: number
  /**
   * End date in ISO 8601 format. Defaults to today in the caller's
   * timezone.
   */
  readonly to?: string
}

/**
 * The page window an {@link ErrorLogQuery} denotes, as ISO dates:
 * the resolved bounds plus the chained next-page bounds.
 * @category Facades
 */
export interface ErrorLogWindow {
  /**
   * ISO date the resolved window starts on.
   */
  readonly fromDate: string
  /**
   * ISO date to feed back as `from` for the next (older) page.
   */
  readonly nextFromDate: string
  /**
   * ISO date to feed back as `to` for the next (older) page.
   */
  readonly nextToDate: string
  /**
   * ISO date the resolved window ends on.
   */
  readonly toDate: string
}

// Re-thrown with the historical "Invalid DateTime" prefix so the
// public failure surface for `{ to: 'not-a-date' }` stays stable.
const parsePlainDate = (iso: string): Temporal.PlainDate => {
  try {
    return Temporal.PlainDate.from(iso)
  } catch (error) {
    throw new Error(`Invalid DateTime: ${iso}`, { cause: error })
  }
}

/**
 * Resolves the page window an error-log query denotes without any wire
 * call — the exact arithmetic the Classic API applies, published so a
 * consumer paging without a Classic session can tile identical windows.
 * @param query - The error-log query to resolve.
 * @param query.from - Pinned window start (ISO date); `offset` is then ignored.
 * @param query.offset - Steps back from `to`, in `(period + 1)`-day strides.
 * @param query.period - Days per page; defaults to `1`.
 * @param query.to - Window end (ISO date); defaults to today.
 * @param timeZone - IANA timezone anchoring "today" when `to` is unset;
 * the host's zone when omitted.
 * @returns The resolved window and its chained next-page bounds.
 * @throws Error with the `Invalid DateTime` prefix on an unparseable
 * `from` or `to`.
 */
export const resolveErrorLogWindow = (
  { from, offset = 0, period = 1, to }: ErrorLogQuery,
  timeZone?: string,
): ErrorLogWindow => {
  // When `from` is set the query is pinned to that single window; offset
  // is therefore moot and ignored. Otherwise pages are stacked
  // backwards from `to` in `period`-sized windows, consecutive pages
  // separated by a one-day boundary so a day is never returned twice —
  // hence the `* (period + 1)` step.
  const fromDateOverride =
    from !== undefined && from !== '' ? parsePlainDate(from) : null
  const daysBack = fromDateOverride === null ? offset * (period + 1) : 0
  const toDate = (
    to !== undefined && to !== ''
      ? parsePlainDate(to)
      : Temporal.Now.plainDateISO(timeZone)
  ).subtract({ days: daysBack })
  const fromDate = fromDateOverride ?? toDate.subtract({ days: period })
  const nextToDate = fromDate.subtract({ days: 1 })
  return {
    fromDate: fromDate.toString(),
    nextFromDate: nextToDate.subtract({ days: period }).toString(),
    nextToDate: nextToDate.toString(),
    toDate: toDate.toString(),
  }
}
