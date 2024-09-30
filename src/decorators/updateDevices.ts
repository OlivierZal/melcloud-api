import type { BaseFacade } from '../facades'
import type { AreaModelAny, BuildingModel, FloorModel } from '../models'
import type {
  DeviceType,
  FailureData,
  GroupAtaState,
  SuccessData,
} from '../types'

export default <T extends boolean | FailureData | GroupAtaState | SuccessData>(
    options: {
      type?: keyof typeof DeviceType
    } = {},
  ) =>
  (
    target: (...args: any[]) => Promise<T>,
    _context: unknown,
  ): ((...args: unknown[]) => Promise<T>) =>
    async function newTarget(
      this: BaseFacade<AreaModelAny | BuildingModel | FloorModel>,
      ...args: unknown[]
    ) {
      const [state] = args
      const data = await target.call(this, state)
      this.devices
        .filter(
          ({ type: deviceType }) =>
            !options.type || deviceType === options.type,
        )
        .forEach((device) => {
          device.update(
            Object.fromEntries(
              Object.entries(state ?? data).filter(
                ([, value]) => value !== null,
              ),
            ),
          )
        })
      return data
    }
