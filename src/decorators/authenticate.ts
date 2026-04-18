import type { Logger } from '../api/interfaces.ts'
import type { ClassicLoginCredentials } from '../types/index.ts'
import { AuthenticationError } from '../errors/index.ts'
import { isHttpError } from '../http/index.ts'

const HTTP_STATUS_UNAUTHORIZED = 401

/*
 * Wrap 401 responses from the HTTP client into a typed
 * {@link AuthenticationError} (preserving the original via `cause`) so
 * credential rejections have a stable, semantic error type. Errors from
 * other sources (fetch-based OIDC flow, network issues, non-401 statuses)
 * are returned unchanged and keep their original type.
 */
const toAuthFailure = (error: unknown): unknown =>
  isHttpError(error) && error.response.status === HTTP_STATUS_UNAUTHORIZED ?
    new AuthenticationError('MELCloud rejected the credentials', {
      cause: error,
    })
  : error

/*
 * Method decorator that wraps the implementation-specific login logic with
 * shared credential resolution and error handling:
 *
 * 1. Resolve credentials from explicit `data` or fall back to stored values.
 * 2. Return `false` immediately if either credential is missing.
 * 3. On success, return the result of the decorated method.
 * 4. On failure: throw if explicit credentials were provided (caller error),
 *    or log and return `false` if using stored credentials (startup/auto-login).
 *    Only 401 HttpErrors are wrapped as {@link AuthenticationError}; other
 *    failures (OIDC flow errors, network issues, non-401 statuses) propagate
 *    as their original error type.
 *
 * Requires the class to expose `password`, `username` (string accessors
 * decorated with @setting) and `logger` (a Logger instance).
 */
export const authenticate = (
  target: (...args: any[]) => Promise<boolean>,
  _context: ClassMethodDecoratorContext,
): ((data?: ClassicLoginCredentials) => Promise<boolean>) =>
  async function newTarget(
    this: { logger: Logger; password: string; username: string },
    data?: ClassicLoginCredentials,
  ): Promise<boolean> {
    const { password = this.password, username = this.username } = data ?? {}
    if (!username || !password) {
      return false
    }
    try {
      return await target.call(this, { password, username })
    } catch (error) {
      const failure = toAuthFailure(error)
      if (data !== undefined) {
        throw failure
      }
      this.logger.error('Authentication failed:', failure)
      return false
    }
  }
