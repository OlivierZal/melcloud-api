import type { DeviceType } from '../enums.ts'
import type { IFacade } from '../facades/index.ts'
import type { IAPI } from '../services/index.ts'
import type {
  Building,
  FailureData,
  GetDeviceData,
  GroupState,
  SetDeviceData,
  SuccessData,
} from '../types/index.ts'

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
    async function newTarget(this: IAPI | IFacade, ...args: unknown[]) {
      const data = await target.call(this, ...args)
      await this.onSync?.({ type })
      return data
    }
