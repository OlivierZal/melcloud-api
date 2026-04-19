import type { ClassicAPIAdapter } from '../api/index.ts'

/**
 * Method decorator factory that triggers `api.fetch()` around the decorated
 * method. With `when: 'before'` (default), the fetch runs first so the
 * method reads a fresh registry. With `when: 'after'`, the fetch runs
 * post-method to capture server-side mutations whose response payload
 * does not carry the updated device fields (e.g. zone-level settings).
 *
 * `api.fetch()` is itself `@syncDevices`-decorated, so a single
 * `@classicFetchDevices` application gives both a truthful registry
 * refresh and the onSync notification — no need to stack `@syncDevices`.
 * @param root0 - Options object.
 * @param root0.when - Whether to fetch before or after the decorated call.
 * @returns A method decorator that fetches around execution.
 */
export const classicFetchDevices =
  ({ when = 'before' }: { when?: 'after' | 'before' } = {}) =>
  <T>(
    target: (...args: any[]) => Promise<T>,
    _context: ClassMethodDecoratorContext,
  ): ((...args: unknown[]) => Promise<T>) =>
    async function newTarget(
      this: { api: ClassicAPIAdapter },
      ...args: unknown[]
    ) {
      if (when === 'before') {
        await this.api.fetch()
      }
      const result = await target.call(this, ...args)
      if (when === 'after') {
        await this.api.fetch()
      }
      return result
    }
