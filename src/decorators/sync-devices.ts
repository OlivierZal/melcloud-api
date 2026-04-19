import type { SyncCallback } from '../api/index.ts'
import type { DeviceType } from '../constants.ts'

/** Object that supports sync notification via `notifySync` or `onSync`. */
interface HasOnSync {
  readonly onSync?: SyncCallback
  readonly notifySync?: (params?: { type?: DeviceType }) => Promise<void>
}

/**
 * Method decorator factory that invokes a sync notification **after**
 * the decorated method resolves. Resolves to the host's `notifySync`
 * (facades — enriches the payload with `ids`) when available,
 * otherwise falls back to `onSync` directly (API services — bare
 * `{ type }` payload). No action is taken if neither hook is exposed.
 *
 * Intended for one-shot post-method notifications; this is **not**
 * a subscription. Exceptions thrown by the consumer's callback
 * propagate — the decorator does not swallow them, so a buggy sync
 * handler surfaces on the caller rather than dying silently.
 * @param root0 - Options object.
 * @param root0.type - Optional device type forwarded in the payload.
 * @returns A method decorator that triggers sync after execution.
 */
export const syncDevices =
  ({ type }: { type?: DeviceType } = {}) =>
  <TArgs extends readonly unknown[], TResult>(
    target: (...args: TArgs) => Promise<TResult>,
    _context: ClassMethodDecoratorContext,
  ): ((...args: TArgs) => Promise<TResult>) =>
    async function newTarget(this: HasOnSync, ...args: TArgs) {
      const data = await target.call(this, ...args)
      await (this.notifySync ?
        this.notifySync({ type })
      : this.onSync?.({ type }))
      return data
    }
