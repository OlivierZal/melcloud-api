/**
 * Unified holiday-mode write contract, shared by the Classic and Home APIs
 * so one window drives both without per-API translation.
 *
 * Every datetime crossing this contract is a zoneless ISO 8601 wall
 * clock in the CALLER's timezone — the `timezone` both API configs
 * take, falling back to the host's zone. Each wire has a clock of its
 * own — Classic stores UTC wall clock, Home reads a window on its
 * unit's — and the facades project at the boundary, in both
 * directions. Naming the zone is the point: the unnamed contract is
 * how a projection got lost once and stranded every Classic window by
 * the caller's UTC offset (the ±1 h of com.melcloud#1593), and "both
 * wires store UTC", said of Home without a measure, is how the Home
 * windows then took that offset the other way, from 49.0.0 to 62.0.2.
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
 * bound the wire left unset. `isEnabled` means the same on both: the
 * wire's flag, and `false` once the window's end, judged when the
 * state is read, has passed.
 * @category Facades
 */
export interface HolidayModeState {
  /**
   * Window end (ISO 8601 wall clock in the caller's timezone), when set.
   */
  readonly endDate: string | null
  /**
   * Whether a window is set and has not ended: the wire's flag until
   * the window's end, `false` from it. Before its start a window set
   * ahead reads as that flag says.
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
 * `isEnabled` is `false`. The start is always explicit: callers pass
 * the full window, and say "from now" with a start of now. Classic
 * sends that start as given; Home sends any start that is not a minute
 * ahead of now a minute ahead, its wire arming a window at its start
 * and taking none that has begun, a window already running included.
 * On Home an enabled window that ends before it can start, as the
 * unit's clock reads it to the second, is refused before any request
 * (a `RangeError`), the wire storing one without a word; on Classic
 * MELCloud is the judge.
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
 * `null` (the mixed marker). A member that is a fold itself, one
 * account's building beside the other's, keeps its mixed fields mixed.
 * @param states - One state, one fold or `null` per member.
 * @returns The aggregated state.
 * @category Facades
 */
export const aggregateHolidayModeStates = (
  states: readonly (AggregatedHolidayModeState | HolidayModeState | null)[],
): AggregatedHolidayModeState => ({
  endDate: allEqual(states.map((state) => state?.endDate ?? null)),
  isEnabled: allEqual(
    states.map((state) => (state === null ? false : state.isEnabled)),
  ),
  startDate: allEqual(states.map((state) => state?.startDate ?? null)),
})
