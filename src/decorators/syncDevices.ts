import type { BaseFacade } from '../facades'
import type {
  AreaModelAny,
  BuildingModel,
  DeviceModelAny,
  FloorModel,
} from '../models'
import type { FailureData, GroupAtaState, SuccessData } from '../types'

export const syncDevices = <
  T extends boolean | FailureData | GroupAtaState | SuccessData,
>(
  target: (...args: any[]) => Promise<T>,
  _context: ClassMethodDecoratorContext,
): ((...args: unknown[]) => Promise<T>) =>
  async function newTarget(
    this: BaseFacade<
      AreaModelAny | BuildingModel | DeviceModelAny | FloorModel
    >,
    ...args: unknown[]
  ) {
    const data = await target.call(this, ...args)
    await this.api.onSync?.()
    return data
  }
