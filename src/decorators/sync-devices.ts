import type { DeviceType } from '../constants.ts'
import type { Facade } from '../facades/index.ts'
import type { APIAdapter } from '../services/index.ts'
import type {
  BuildingWithStructure,
  FailureData,
  GetDeviceData,
  GroupState,
  SetDeviceData,
  SuccessData,
} from '../types/index.ts'

/**
 * Method decorator factory that invokes the sync callback after the decorated method completes.
 * @param root0 - Options object.
 * @param root0.type - Optional device type to pass to the sync callback.
 * @returns A method decorator that triggers sync after execution.
 */
export const syncDevices =
  <
    T extends DeviceType,
    U extends
      | boolean
      | BuildingWithStructure[]
      | FailureData
      | GetDeviceData<T>
      | GroupState
      | SetDeviceData<T>
      | SuccessData,
  >({
    type,
  }: {
    type?: T
  } = {}) =>
  (
    target: (...args: any[]) => Promise<U>,
    _context: ClassMethodDecoratorContext,
  ): ((...args: unknown[]) => Promise<U>) =>
    async function newTarget(this: APIAdapter | Facade, ...args: unknown[]) {
      const data = await target.call(this, ...args)
      await ('notifySync' in this ?
        this.notifySync({ type })
      : this.onSync?.({ type }))
      return data
    }
