import { AuthenticationError } from './authentication.ts'

/**
 * MELCloud is temporarily refusing sign-ins (login throttle): Classic
 * reports it as `ErrorId 6` on `ClientLogin3`, Home as HTTP 429 from
 * the token endpoints. Retrying a login keeps the lockout alive, so the
 * automatic re-login backoff widens when this error arms it; sessions
 * established BEFORE the throttle keep working (MELCloud stays generous
 * with existing keys).
 */
export class AuthenticationThrottledError extends AuthenticationError {
  public override readonly name = 'AuthenticationThrottledError'
}
