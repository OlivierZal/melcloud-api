import type { BaseFacade } from '../facades/index.js'
import type {
  AreaModelAny,
  BuildingModel,
  DeviceModelAny,
  FloorModel,
} from '../models/index.js'
import type { API } from '../services/index.js'
import type {
  Building,
  FailureData,
  GroupAtaState,
  SuccessData,
} from '../types/index.js'

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
