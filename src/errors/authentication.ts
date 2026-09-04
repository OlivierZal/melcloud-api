// Thin re-export of @olivierzal/api-core's AuthenticationError (the
// session mechanism gates its login backoff on it, so the class must
// be the core's). Which refusals wear it stays this SDK's verdict:
// Classic's `LoginData: null` body and Home's BFF 401 both normalize
// into it at their own boundaries.
export { AuthenticationError } from '@olivierzal/api-core'
