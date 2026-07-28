/**
 * Hours of continuous negative signal before a device facade reports
 * `isAvailable: false` — day-scale on BOTH dialects by design: Classic's
 * `LastTimeStamp` is building-local wall clock (±14 h of worldwide skew)
 * and its `Offline` flag is a ~2-4 min staleness boolean that flaps on
 * healthy units (live-probed 2026-07-28), while Home's `isConnected` has
 * a live-probed positive side but an unproven negative one — a
 * persistence window this wide turns any Classic-style tight-threshold
 * boolean harmless.
 */
export const STALE_COMMUNICATION_HOURS = 24

/** Cross-dialect reachability contract: `true` while MELCloud can deliver writes to the unit. */
export interface AvailabilityAware {
  readonly isAvailable: boolean
}

/** Base identifiable entity with numeric ID and display name. */
export interface Identifiable {
  readonly id: number
  readonly name: string
}
