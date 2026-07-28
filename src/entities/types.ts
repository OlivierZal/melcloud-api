/** Cross-dialect reachability contract: `true` while MELCloud can deliver writes to the unit. */
export interface AvailabilityAware {
  readonly isAvailable: boolean
}

/** Base identifiable entity with numeric ID and display name. */
export interface Identifiable {
  readonly id: number
  readonly name: string
}
