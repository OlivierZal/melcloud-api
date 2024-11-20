import type { DeviceType } from '../enums.js'
import type { IFacade } from '../facades/interfaces.js'
import type { IAPI } from '../services/interfaces.js'
import type {
  Building,
  FailureData,
  GetDeviceData,
  GroupAtaState,
  SetDeviceData,
  SuccessData,
} from '../types/index.js'

export const syncDevices =
  <
    T extends DeviceType,
    U extends
      | boolean
      | Building[]
      | FailureData
      | GetDeviceData<T>
      | GroupAtaState
      | SetDeviceData<T>
      | SuccessData,
  >(params?: {
    type?: T
  }) =>
  (
    target: (...args: any[]) => Promise<U>,
    _context: ClassMethodDecoratorContext,
  ): ((...args: unknown[]) => Promise<U>) =>
    async function newTarget(this: IAPI | IFacade, ...args: unknown[]) {
      const data = await target.call(this, ...args)
      await this.onSync?.(params)
      return data
    }
