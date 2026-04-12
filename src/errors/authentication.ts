import { APIError } from './base.ts'

/**
 * The server rejected the credentials, the login form could not be
 * parsed, or the reactive re-authentication after a 401 failed.
 */
export class AuthenticationError extends APIError {
  public override readonly name = 'AuthenticationError'
}
