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
    context: ClassMethodDecoratorContext,
  ): ((...args: unknown[]) => Promise<T>) =>
    async function newTarget(
      this: BaseFacade<AreaModelAny | BuildingModel | FloorModel>,
      ...args: unknown[]
    ) {
      const [arg] = args
      const data = await target.call(this, arg)
      const newData = String(context.name) === 'SetPower' ?
          { Power: arg }
        : Object.fromEntries(
          Object.entries(arg ?? data).filter(
            ([, value]) => value !== undefined && value !== null,
          ),
        )
      this.devices
        .filter(
          ({ type: deviceType }) =>
            !options.type || deviceType === options.type,
        )
        .forEach((device) => {
          device.update(newData)
        })
      return data
    }
