import type { ClassicAPIAdapter } from '../api/index.ts'
import type { ClassicDeviceType } from '../constants.ts'
import type {
  ClassicListDeviceData,
  ClassicZoneSettings,
} from '../types/index.ts'

/**
 * Method decorator that triggers a API fetch before executing the decorated method.
 * @param target - The original method to wrap.
 * @param _context - Decorator context provided by the runtime.
 * @returns A wrapper that fetches devices before calling the original method.
 */
export const classicFetchDevices = <
  T extends ClassicListDeviceData<ClassicDeviceType> | ClassicZoneSettings,
>(
  target: (...args: unknown[]) => Promise<T>,
  _context: ClassMethodDecoratorContext,
): ((...args: unknown[]) => Promise<T>) =>
  async function newTarget(
    this: { api: ClassicAPIAdapter },
    ...args: unknown[]
  ) {
    await this.api.fetch()
    return target.call(this, ...args)
  }
