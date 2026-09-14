import type { Logger } from '../api/index.ts'

// The hosts either carry the SDK logger under `logger` (`HomeAPI`,
// through the core's `SessionAPI`) or none at all (the Classic
// facades), so the presence check is the whole shape check.
const hasLogger = (host: object): host is { readonly logger: Logger } =>
  'logger' in host

/**
 * Method decorator factory that runs an explicit registry refresh
 * around the decorated method.
 *
 * - `when: 'before'` (default): the refresh runs first so the method
 *   body reads a fresh registry. Refresh errors propagate to the caller.
 * - `when: 'after'`: the refresh runs post-method to capture server-side
 *   mutations whose response carries no device fields (Classic
 *   frost/holiday envelopes, Home setpoint PUTs). Fail-soft — refresh
 *   failures are logged through the host's `logger`, when it has one,
 *   and swallowed so a stale-registry error cannot mask the landed
 *   mutation.
 *
 * The refresh is a callback typed against the host class, so the path
 * each site takes (`syncRegistry()` on `HomeAPI`, `api.fetch()` on a
 * Classic facade) is written where the decorator is applied and checked
 * by the compiler. Annotate `self` at the site: the host type is bound
 * at the factory call, before the target is seen.
 * @param root0 - Options object.
 * @param root0.refresh - The registry refresh, handed the host.
 * @param root0.when - Whether to refresh before or after the call.
 * @returns A method decorator.
 * @category Decorators
 */
export const fetchDevices =
  <THost extends object>({
    refresh,
    when = 'before',
  }: {
    readonly when?: 'after' | 'before'
    readonly refresh: (self: THost) => Promise<unknown>
  }) =>
  <TArgs extends readonly unknown[], TResult>(
    target: (this: THost, ...args: TArgs) => Promise<TResult>,
    _context: ClassMethodDecoratorContext,
  ): ((this: THost, ...args: TArgs) => Promise<TResult>) =>
    async function newTarget(this: THost, ...args: TArgs) {
      if (when === 'before') {
        await refresh(this)
      }
      const result = await target.call(this, ...args)
      if (when === 'after') {
        try {
          await refresh(this)
        } catch (error) {
          if (hasLogger(this)) {
            this.logger.error(
              'Failed to refresh registry after mutation:',
              error,
            )
          }
        }
      }
      return result
    }
