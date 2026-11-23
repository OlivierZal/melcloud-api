import { Temporal } from '../temporal.ts'

/**
 * Hours of continuous negative signal before a device facade reports
 * `isAvailable: false` — day-scale on BOTH dialects by design: Classic's
 * `LastTimeStamp` is building-local wall clock (±14 h of worldwide skew)
 * and its `Offline` flag is a ~2-4 min staleness boolean that flaps on
 * healthy units (live-probed 2026-07-28), while Home's `isConnected` has
 * a live-probed positive side but an unproven negative one — a
 * persistence window this wide turns any Classic-style tight-threshold
 * boolean harmless.
 * @category Entities
 */
export const STALE_COMMUNICATION_HOURS = 24

/**
 * Whether a disconnection streak that opened at `since` has outlived
 * {@link STALE_COMMUNICATION_HOURS}: the ONE predicate behind Home's
 * `isAvailable` and its `stale` connectivity transition, so the facade
 * and the entity read the same clock against the same threshold: the
 * facade on every read, the entity on every sync, so the transition
 * follows a greyed tile at the next sync.
 * @param since - Start of the streak, UTC wall clock.
 * @returns `true` once the streak is older than the stale window.
 */
export const hasOutlivedStaleWindow = (
  since: Temporal.PlainDateTime,
): boolean =>
  Temporal.Now.plainDateTimeISO('UTC').since(since).total('hours') >
  STALE_COMMUNICATION_HOURS

/**
 * Whether a Classic unit's last communication, as its listing stamps
 * it, is older than {@link STALE_COMMUNICATION_HOURS}: the ONE
 * predicate behind Classic's `isAvailable` and its `stale`
 * communication edge, read by the facade on every read and by the
 * entity on every sync. `LastTimeStamp` is building-local wall clock
 * and the anchor deliberately UTC, not the configured zone: UTC bounds
 * a healthy unit's apparent silence at 14 h for any pair of host and
 * building zones, where a configured-zone anchor could reach 26 h
 * (a UTC+13 host, a UTC-11 building) and flag a live unit. A stamp
 * that cannot be read, or one ahead of the clock, reads as heard from.
 * @param lastTimestamp - The listing's `LastTimeStamp`.
 * @returns `true` once the unit has been silent for over the window.
 */
export const hasStoppedCommunicating = (lastTimestamp: string): boolean => {
  try {
    return hasOutlivedStaleWindow(Temporal.PlainDateTime.from(lastTimestamp))
  } catch {
    return false
  }
}

/**
 * Cross-dialect reachability contract: `true` while MELCloud can deliver writes
 * to the unit.
 * @category Entities
 */
export interface AvailabilityAware {
  readonly isAvailable: boolean
}

/**
 * Cross-dialect fault contract: what the unit ITSELF reports — a fault
 * MELCloud relays (an indoor/outdoor communication error, a sensor
 * failure), never one the cloud or this SDK raised. Orthogonal to
 * {@link AvailabilityAware}: a faulted unit usually stays reachable and
 * keeps answering writes, which is exactly why a consumer must say so.
 * @category Entities
 */
export interface FaultAware {
  /**
   * The fault as the dialect words it on the read: Classic's
   * `ErrorMessages`, a sentence in the account's language (`E6 : …`);
   * Home's `ErrorCode` setting, the code alone (`E6`). `null` while there
   * is no fault, or when the read gives no wording.
   */
  readonly errorMessage: string | null
  /**
   * `true` while the unit reports a fault of its own (Classic `HasError`,
   * Home `isInError`).
   */
  readonly isInError: boolean
}

/**
 * Base identifiable contract: an id (numeric on Classic, GUID string on
 * Home) and a display name.
 * @template TId - Identifier type; defaults to Classic's numeric ids.
 * @category Entities
 */
export interface Identifiable<TId extends number | string = number> {
  readonly id: TId
  readonly name: string
}
