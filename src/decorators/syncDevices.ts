import type { BaseSuperDeviceFacade } from '../facades'
import type { AreaModelAny, BuildingModel, FloorModel } from '../models'
import type {
  Building,
  FailureData,
  GroupAtaState,
  SuccessData,
} from '../types'

export default <
  T extends Building[] | FailureData | GroupAtaState | SuccessData,
>(
  target: (...args: any[]) => Promise<T>,
  _context: unknown,
): ((...args: unknown[]) => Promise<T>) =>
  async function newTarget(
    this: BaseSuperDeviceFacade<AreaModelAny | BuildingModel | FloorModel>,
    ...args: unknown[]
  ) {
    const data = await target.call(this, ...args)
    await this.api.onSync?.()
    return data
  }
