import type { BaseFacade } from '../facades'
import type {
  AreaModelAny,
  BuildingModel,
  DeviceModelAny,
  FloorModel,
} from '../models'
import type { API } from '../services'
import type {
  Building,
  FailureData,
  GroupAtaState,
  SuccessData,
} from '../types'

export const syncDevices = <
  T extends boolean | Building[] | FailureData | GroupAtaState | SuccessData,
>(
  target: (...args: any[]) => Promise<T>,
  _context: ClassMethodDecoratorContext,
): ((...args: unknown[]) => Promise<T>) =>
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
