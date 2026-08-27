// Thin re-export of @olivierzal/api-core (mechanism extracted with the
// rest of the resilience chain; heatzy-api does not consume this one).
export type { RateLimitDurationLike } from '@olivierzal/api-core'

export { formatDurationHuman, RateLimitGate } from '@olivierzal/api-core'
