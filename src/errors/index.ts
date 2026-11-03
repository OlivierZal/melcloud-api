export { EntityNotFoundError } from './entity-not-found.ts'
export { NoChangesError, tolerateNoChanges } from './no-changes.ts'
export { assertUpdateAccepted, UpdateRejectedError } from './update-rejected.ts'
// The core's error family is forwarded under unchanged names so
// `instanceof` holds across the SDK and the core alike, and the three
// failure-log helpers that judge it ride beside it, so a host logs its
// own cloud failures the way this SDK logs its seats — one line naming
// the cause chain for a failure the core has a class for, the error
// object for anything else — through the family's one api-core pin,
// this SDK's. The classes declared here are the protocol's own, and
// they extend `APIError` through the package specifier — never through
// this barrel, which would form an eval-time cycle under `class extends`.
export {
  APIError,
  AuthenticationError,
  AuthenticationThrottledError,
  failureCauseChain,
  isAPIError,
  isKnownFailure,
  logFailure,
  RateLimitError,
  RegistrySyncError,
  ValidationError,
} from '@olivierzal/api-core'
