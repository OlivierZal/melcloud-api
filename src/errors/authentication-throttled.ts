// Thin re-export of @olivierzal/api-core's AuthenticationThrottledError
// (the core's login backoff widens on it and honours its `retryAfter`
// window). The protocol vocabulary stays here: Classic reports the
// throttle as `ErrorId 6` with a `LoginMinutes` countdown, Home as
// HTTP 429 from the token endpoints — each dialect constructs the
// class at its own boundary.
export { AuthenticationThrottledError } from '@olivierzal/api-core'
