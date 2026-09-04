// Thin re-export of @olivierzal/api-core's RegistrySyncError (thrown
// by the core's `authenticate()` when the enforced post-auth registry
// sync fails, so the class must be the core's). The contract it names:
// the sign-in round-trip was ACCEPTED and the session stands — this
// rejection says "signed in, but the registry could not be verified",
// never "sign-in refused"; a refused credential is never wrapped in it.
export { RegistrySyncError } from '@olivierzal/api-core'
