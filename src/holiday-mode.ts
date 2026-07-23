/**
 * Unified holiday-mode write contract, shared by the Classic and Home APIs
 * so one window drives both without per-API translation.
 * @module
 */

/**
 * A holiday-mode window to apply. `startDate`/`endDate` are ISO 8601
 * wall-clock strings; both are ignored when `isEnabled` is `false`. The
 * start is always explicit (the Home API carries no timezone context to
 * anchor a "now" default), so callers pass the full window.
 * @category Facades
 */
export interface HolidayModeUpdate {
  /** Window end (ISO 8601). Ignored when `isEnabled` is `false`. */
  readonly endDate: string
  /** Whether holiday mode is on. */
  readonly isEnabled: boolean
  /** Window start (ISO 8601). Ignored when `isEnabled` is `false`. */
  readonly startDate: string
}
