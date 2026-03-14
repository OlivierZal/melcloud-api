import type { DeviceType } from '../enums.ts'
import type { Facade } from '../facades/index.ts'
import type { APIAdapter } from '../services/index.ts'
import type {
  Building,
  FailureData,
  GetDeviceData,
  GroupState,
  SetDeviceData,
  SuccessData,
} from '../types/index.ts'

/** Method decorator factory that invokes the `onSync` callback after the decorated method completes. */
export const syncDevices =
  <
    T extends DeviceType,
    U extends
      | boolean
      | Building[]
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
      await this.onSync?.({ type })
      return data
    }
