// Thin re-export of @olivierzal/api-core (the mechanism formerly
// duplicated here as heatzy-api's twin). The core settled the drift on
// heatzy's monotonic deadline — no timer to leak, immune to system
// clock jumps — while keeping this SDK's `Disposable` surface.
export { RetryGuard } from '@olivierzal/api-core'
