import type { ClassicAPIAdapter, Logger } from '../api/index.ts'

/**
 * Structural contract consumed by {@link fetchDevices}. A host class
 * must expose at least one of:
 * - `syncRegistry()` — BaseAPI-derived classes.
 * - `api.fetch()` — Classic facades.
 *
 * When both are present, `syncRegistry()` wins. `logger` is optional;
 * if provided, post-mutation sync failures are logged through it.
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

  // Structural contract violation: the decorator was applied to a
  // host that exposes neither hook. Failing loudly at the first
  // invocation is preferable to silently no-op'ing — a no-op
  // refresh would give consumers a misleading sense that the
  // registry is up to date.
  throw new TypeError(
    'fetchDevices: host exposes neither syncRegistry() nor api.fetch() — ' +
      'decorator cannot resolve a refresh path',
  )
}

/**
 * Method decorator factory that triggers a registry refresh around
 * the decorated method.
 *
 * - `when: 'before'` (default): refresh runs first so the method body
 *   reads a fresh registry. Refresh errors propagate to the caller.
 * - `when: 'after'`: refresh runs post-method to capture server-side
 *   mutations whose response carries no device fields (Classic
 *   frost/holiday envelopes, Home setpoint PUTs). Fail-soft —
 *   refresh failures are logged and swallowed so a stale-registry
 *   error cannot mask the landed mutation.
 *
 * Refresh path is resolved structurally via the `FetchDevicesHost`
 * shape (the host must expose `fetch()` or `registry.sync()`).
 * @param root0 - Options object.
 * @param root0.when - Whether to refresh before or after the call.
 * @returns A method decorator.
 * @category Decorators
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
