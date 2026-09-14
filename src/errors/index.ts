export { EntityNotFoundError } from './entity-not-found.ts'
export { NoChangesError, tolerateNoChanges } from './no-changes.ts'
export { assertUpdateAccepted, UpdateRejectedError } from './update-rejected.ts'
// The core's error family is forwarded under unchanged names so
// `instanceof` holds across the SDK and the core alike; the classes
// declared here are the protocol's own, and they extend `APIError`
// through the package specifier — never through this barrel, which
// would form an eval-time cycle under `class extends`.
export {
  APIError,
  AuthenticationError,
  AuthenticationThrottledError,
  isAPIError,
  RateLimitError,
  RegistrySyncError,
  ValidationError,
} from '@olivierzal/api-core'
