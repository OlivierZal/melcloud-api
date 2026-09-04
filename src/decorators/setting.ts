// Thin re-export of @olivierzal/api-core's `setting` accessor
// decorator (the core's session mechanism persists `expiry`,
// `loginBackoffUntil`, `password` and `username` through it, so the
// delegation logic must be the core's). The storage key is the
// accessor name, resolved once at decoration time — a data contract:
// hosts already hold values under these keys, so renaming a decorated
// accessor strands the stored value.
export { setting } from '@olivierzal/api-core'
