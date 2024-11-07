import type { DeviceType } from '../enums.js'
import type { BaseFacade } from '../facades/base.js'
import type { BuildingModel, FloorModel } from '../models/index.js'
import type { AreaModelAny, DeviceModelAny } from '../models/interfaces.js'
import type { API } from '../services/api.js'
import type {
  Building,
  FailureData,
  GetDeviceData,
  GroupAtaState,
  SetDeviceData,
  SuccessData,
} from '../types/index.js'

export const syncDevices = <
  T extends keyof typeof DeviceType,
  U extends
    | boolean
    | Building[]
    | FailureData
    | GetDeviceData[T]
    | GroupAtaState
    | SetDeviceData[T]
    | SuccessData,
>(
  target: (...args: any[]) => Promise<U>,
  _context: ClassMethodDecoratorContext,
): ((...args: unknown[]) => Promise<U>) =>
  async function newTarget(
    this:
      | API
      | BaseFacade<AreaModelAny | BuildingModel | DeviceModelAny | FloorModel>,
    ...args: unknown[]
  ) {
    const data = await target.call(this, ...args)
    await ('api' in this ? this.api : this).onSync?.()
    return data
  }
