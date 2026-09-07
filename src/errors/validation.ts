// Thin re-export of @olivierzal/api-core's ValidationError, the
// RegistrySyncError pattern: the class is the core's since 1.3.0 (it
// imports nothing from zod — the zod coupling that keeps `parseOrThrow`
// here never applied to it), so both SDKs throw ONE type at their
// validation boundaries and a host classifies drift by `instanceof`
// whatever wire it talks to. `parseOrThrow` (`src/validation`) still
// constructs it, with the `ZodError` on `cause`.
export { ValidationError } from '@olivierzal/api-core'
