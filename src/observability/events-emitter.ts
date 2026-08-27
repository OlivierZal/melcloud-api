// Thin re-export of @olivierzal/api-core's emitter: the swallowing
// mechanism lives there; this SDK's `LifecycleEvents` alias binds the
// sync-params vocabulary at each construction site through inference.
export { LifecycleEmitter } from '@olivierzal/api-core'
