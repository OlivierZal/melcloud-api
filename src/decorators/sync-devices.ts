import type { DeviceType } from '../constants.ts'

/**
 * Object that supports sync notification via `notifySync`. Both
 * BaseAPI (bare `{ type }` payload, routed through the lifecycle
 * emitter) and facades (enrich the payload with `ids` then delegate
 * to `api.notifySync`) implement this contract structurally.
 */
interface HasNotifySync {
  readonly notifySync?: (params?: {
    ids?: (number | string)[]
    type?: DeviceType
  }) => Promise<void>
}

/**
 * Method decorator factory that invokes a sync notification **after**
 * the decorated method resolves. The host implements `notifySync`
 * structurally — facades enrich the payload with `ids` before
 * delegating, BaseAPI emits straight through the lifecycle emitter.
 * No action is taken when the host doesn't expose the hook.
 *
 * Intended for one-shot post-method notifications; this is **not**
 * a subscription. Exceptions thrown by the consumer's callback
 * propagate — the decorator does not swallow them, so a buggy sync
 * handler surfaces on the caller rather than dying silently.
 * @param root0 - Options object.
 * @param root0.type - Optional device type forwarded in the payload.
 * @returns A method decorator that triggers sync after execution.
 * @category Decorators
 */
export const syncDevices =
  ({ type }: { type?: DeviceType } = {}) =>
  <TArgs extends readonly unknown[], TResult>(
    target: (...args: TArgs) => Promise<TResult>,
    _context: ClassMethodDecoratorContext,
  ): ((...args: TArgs) => Promise<TResult>) =>
    async function newTarget(this: HasNotifySync, ...args: TArgs) {
      const data = await target.call(this, ...args)
      await this.notifySync?.({ type })
      return data
    }
