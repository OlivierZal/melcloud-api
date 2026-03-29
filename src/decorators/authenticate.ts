import type { Logger } from '../services/interfaces.ts'
import type { LoginCredentials } from '../types/index.ts'

/*
 * Method decorator that wraps the implementation-specific login logic with
 * shared credential resolution and error handling:
 *
 * 1. Resolve credentials from explicit `data` or fall back to stored values.
 * 2. Return `false` immediately if either credential is missing.
 * 3. On success, return the result of the decorated method.
 * 4. On failure: throw if explicit credentials were provided (caller error),
 *    or log and return `false` if using stored credentials (startup/auto-login).
 *
 * Requires the class to expose `password`, `username` (string accessors
 * decorated with @setting) and `logger` (a Logger instance).
 */
export const authenticate = (
  target: (...args: any[]) => Promise<boolean>,
  _context: ClassMethodDecoratorContext,
): ((data?: LoginCredentials) => Promise<boolean>) =>
  async function newTarget(
    this: { logger: Logger; password: string; username: string },
    data?: LoginCredentials,
  ): Promise<boolean> {
    const { password = this.password, username = this.username } = data ?? {}
    if (!username || !password) {
      return false
    }
    try {
      return await target.call(this, { password, username })
    } catch (error) {
      if (data !== undefined) {
        throw error
      }
      this.logger.error('Authentication failed:', error)
      return false
    }
  }
