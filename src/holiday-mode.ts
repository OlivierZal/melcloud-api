/**
 * Unified holiday-mode write contract, shared by the Classic and Home APIs
 * so one window drives both without per-API translation.
 *
 * Every datetime crossing this contract is a zoneless ISO 8601 wall
 * clock in the CALLER's timezone — the `timezone` both API configs
 * take, falling back to the host's zone. Both wires store UTC; the
 * facades project at the boundary, in both directions. Naming the zone
 * is the point: the unnamed contract is how a projection got lost once
 * and stranded every window by the caller's UTC offset (the ±1 h of
 * com.melcloud#1593).
 */
import { allEqual } from './utils.ts'

/**
 * Per-member fold of holiday-mode states across a multi-device target:
 * each field carries the value every member shares, `null` on
 * divergence — a never-configured member's absent flag folds as
 * `false`, its absent bounds as `null`.
 * @category Facades
 */
export interface AggregatedHolidayModeState {
  /**
   * Shared window end, `null` when mixed or unset.
   */
  readonly endDate: string | null
  /**
   * Whether holiday mode is on everywhere, `null` when mixed.
   */
  readonly isEnabled: boolean | null
  /**
   * Shared window start, `null` when mixed or unset.
   */
  readonly startDate: string | null
}

/**
 * Last-known holiday-mode window — the cross-dialect read twin of
 * {@link HolidayModeUpdate}. Classic maps its `HM*` wire fields onto it,
 * Home its camelCase `/context` descriptor; a `null` date is a window
 * bound the wire left unset.
 * @category Facades
 */
export interface HolidayModeState {
  /**
   * Window end (ISO 8601 wall clock in the caller's timezone), when set.
   */
  readonly endDate: string | null
  /**
   * Whether holiday mode is on.
   */
  readonly isEnabled: boolean
  /**
   * Window start (ISO 8601 wall clock in the caller's timezone), when
   * set.
   */
  readonly startDate: string | null
}

/**
 * A holiday-mode window to apply. `startDate`/`endDate` are ISO 8601
 * wall-clock strings in the caller's timezone; both are ignored when
 * `isEnabled` is `false`. The start is always explicit (the Home API
 * carries no timezone context to anchor a "now" default), so callers
 * pass the full window.
 * @category Facades
 */
export interface HolidayModeUpdate {
  /**
   * Window end (ISO 8601, caller's wall clock). Ignored when
   * `isEnabled` is `false`.
   */
  readonly endDate: string
  /**
   * Whether holiday mode is on.
   */
  readonly isEnabled: boolean
  /**
   * Window start (ISO 8601, caller's wall clock). Ignored when
   * `isEnabled` is `false`.
   */
  readonly startDate: string
}

/**
 * Folds per-member holiday-mode states into the aggregate a
 * multi-device target answers: a never-configured member reads as
 * disabled with unset bounds, and any per-field divergence folds to
 * `null` (the mixed marker).
 * @param states - One state (or `null`) per member.
 * @returns The aggregated state.
 */
export const aggregateHolidayModeStates = (
  states: readonly (HolidayModeState | null)[],
): AggregatedHolidayModeState => ({
  endDate: allEqual(states.map((state) => state?.endDate ?? null)),
  isEnabled: allEqual(states.map((state) => state?.isEnabled ?? false)),
  startDate: allEqual(states.map((state) => state?.startDate ?? null)),
})
