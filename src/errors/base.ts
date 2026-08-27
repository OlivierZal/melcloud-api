// Thin re-export of @olivierzal/api-core's error base (formerly
// heatzy-api's byte-identical twin): ONE `APIError` class family wide,
// so `isAPIError` holds across this SDK's protocol errors and the
// core's `RateLimitError` alike.
export { APIError, isAPIError } from '@olivierzal/api-core'
