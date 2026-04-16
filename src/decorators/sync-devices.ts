import type { OnSyncFunction } from '../api/index.ts'
import type { ClassicDeviceType } from '../constants.ts'

/** Object that supports sync notification via `notifySync` or `onSync`. */
interface HasOnSync {
  readonly onSync?: OnSyncFunction
  readonly notifySync?: (params?: { type?: ClassicDeviceType }) => Promise<void>
}

/**
 * Method decorator factory that invokes the sync callback after the decorated method completes.
 * Works with any class that exposes `notifySync` (facades) or `onSync` (API services).
 * @param root0 - Options object.
 * @param root0.type - Optional device type to pass to the sync callback.
 * @returns A method decorator that triggers sync after execution.
 */
export const syncDevices =
  ({
    type,
  }: {
    type?: ClassicDeviceType
  } = {}) =>
  <TResult>(
    target: (...args: any[]) => Promise<TResult>,
    _context: ClassMethodDecoratorContext,
  ): ((...args: unknown[]) => Promise<TResult>) =>
    async function newTarget(this: HasOnSync, ...args: unknown[]) {
      const data = await target.call(this, ...args)
      await (this.notifySync ?
        this.notifySync({ type })
      : this.onSync?.({ type }))
      return data
    }
