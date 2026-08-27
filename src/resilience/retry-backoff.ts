// Thin re-export of @olivierzal/api-core (the mechanism formerly
// duplicated here as heatzy-api's twin).
export type { RetryBackoffOptions } from '@olivierzal/api-core'

export {
  DEFAULT_TRANSIENT_RETRY_OPTIONS,
  isTransientServerError,
  withRetryBackoff,
} from '@olivierzal/api-core'
