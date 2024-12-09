import type { DeviceType } from '../enums.ts'
import type { IFacade } from '../facades/interfaces.ts'
import type { IAPI } from '../services/interfaces.ts'
import type { GroupState } from '../types/ata.ts'
import type {
  Building,
  FailureData,
  GetDeviceData,
  SetDeviceData,
  SuccessData,
} from '../types/common.ts'

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
