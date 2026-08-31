import { APIError } from './base.ts'

/**
 * The sign-in round-trip was ACCEPTED but the enforced post-auth
 * registry sync failed: the session is established and the credentials
 * persisted, yet the registry could not be verified against the
 * server. Thrown by `authenticate()` with the sync's own failure (a
 * `ValidationError`, a transport error, any registry error) preserved
 * as `cause`, so consumers can tell "signed in, stale list" from a
 * refused credential BY TYPE instead of re-deriving the verdict from
 * `isAuthenticated()` — a discriminator with a real false positive: a
 * transport failure during a sign-in over a PRE-EXISTING live session
 * (a user switching accounts) reads "signed in" while the new pair was
 * never accepted. A refused credential is never wrapped in this type:
 * it stays `AuthenticationError`.
 * @category Errors
 */
export class RegistrySyncError extends APIError {
  public override readonly name: string = 'RegistrySyncError'
}
