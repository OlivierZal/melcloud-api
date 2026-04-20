import type { ClassicAPIAdapter, Logger } from '../api/index.ts'

/**
 * Structural contract consumed by {@link fetchDevices}. A host class
 * must expose **at least one** of:
 * - `syncRegistry()` — BaseAPI-derived classes (template hook).
 * - `api.fetch()` — Classic facades (delegate to the underlying API).
 *
 * When both are present, `syncRegistry()` wins. The runtime resolution
 * is polymorphic by design: the same decorator serves Classic facades
 * (zone-level writes with empty response payloads) and HomeAPI methods
 * (setpoint PUTs whose effect lives exclusively on the server).
 *
 * `logger` is optional. When `when: 'after'`, a post-mutation sync
 * failure is logged via `logger.error` and swallowed — the mutation
 * already landed on the server, so a stale-registry error must not
 * mask the successful write.
 */
interface FetchDevicesHost {
  readonly api?: Pick<ClassicAPIAdapter, 'fetch'>
  readonly logger?: Logger
  readonly syncRegistry?: () => Promise<void>
}

const runSync = async (self: FetchDevicesHost): Promise<void> => {
  if (self.syncRegistry) {
    await self.syncRegistry()
    return
  }
  if (self.api) {
    await self.api.fetch()
    return
  }

  /*
   * Structural contract violation: the decorator was applied to a
   * host that exposes neither hook. Failing loudly at the first
   * invocation is preferable to silently no-op'ing — a no-op
   * refresh would give consumers a misleading sense that the
   * registry is up to date.
   */
  throw new TypeError(
    'fetchDevices: host exposes neither syncRegistry() nor api.fetch() — ' +
      'decorator cannot resolve a refresh path',
  )
}

/**
 * Method decorator factory that triggers a registry refresh around
 * the decorated method. With `when: 'before'` (default), the refresh
 * runs first so the method reads a fresh registry. With
 * `when: 'after'`, the refresh runs post-method to capture
 * server-side mutations whose response payload does not carry the
 * updated device fields (e.g. Classic frost/holiday envelopes,
 * HomeAPI setpoint PUTs).
 *
 * The refresh mechanism is resolved structurally via
 * {@link FetchDevicesHost}: BaseAPI-derived classes use their
 * `syncRegistry()` template hook; facades fall back to
 * `api.fetch()`. Either path eventually fires `onSync` (via the
 * `@syncDevices`-decorated terminal call), so a single `after`
 * application gives both a truthful registry refresh AND the
 * notification — no need to stack `@syncDevices`.
 *
 * `when: 'after'` is fail-soft: refresh failures are logged via
 * `logger.error` and swallowed, so a buggy `onSync` cannot mask a
 * landed mutation. `when: 'before'` **does** surface refresh errors
 * — the method body hasn't run yet, and the caller should know the
 * registry is stale before acting on it.
 * @param root0 - Options object.
 * @param root0.when - Whether to refresh before or after the call.
 * @returns A method decorator.
 */
export const fetchDevices =
  ({ when = 'before' }: { when?: 'after' | 'before' } = {}) =>
  <TArgs extends readonly unknown[], TResult>(
    target: (...args: TArgs) => Promise<TResult>,
    _context: ClassMethodDecoratorContext,
  ): ((...args: TArgs) => Promise<TResult>) =>
    async function newTarget(this: FetchDevicesHost, ...args: TArgs) {
      if (when === 'before') {
        await runSync(this)
      }
      const result = await target.call(this, ...args)
      if (when === 'after') {
        try {
          await runSync(this)
        } catch (error) {
          this.logger?.error(
            'Failed to refresh registry after mutation:',
            error,
          )
        }
      }
      return result
    }
