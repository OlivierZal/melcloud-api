// Thin re-export of @olivierzal/api-core's `syncDevices` decorator
// factory, generic over the payload it forwards: `@syncDevices()`
// notifies without one, `@syncDevices({ type })` forwards this SDK's
// `SyncParams` shape verbatim to the host's `notifySync` (`BaseAPI`'s,
// routed through the lifecycle emitter; a facade enriches it with
// `ids` before delegating). The core carried melcloud's factory form
// in 1.3.0 — heatzy's bare form was the drift — with one delta: a
// bare `@syncDevices()` forwards `undefined` where the local copy
// forwarded `{ type: undefined }`.
export { syncDevices } from '@olivierzal/api-core'
