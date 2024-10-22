import type { BaseFacade } from '../facades/index.js'
import type {
  AreaModelAny,
  BuildingModel,
  FloorModel,
} from '../models/index.js'
import type {
  DeviceType,
  FailureData,
  GroupAtaState,
  SuccessData,
} from '../types/index.js'

export const updateDevices =
  <T extends boolean | FailureData | GroupAtaState | SuccessData>(
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
      if (arg !== null && typeof arg === 'object' && !Object.keys(arg).length) {
        throw new Error('No data to set')
      }
      const data = await target.call(this, arg)
      const newData =
        String(context.name) === 'SetPower' ?
          { Power: arg }
        : Object.fromEntries(
            Object.entries(arg ?? data).filter(
              ([, value]) => value !== undefined && value !== null,
            ),
          )
      ;(options.type ?
        this.devices.filter(
          ({ type: deviceType }) => deviceType === options.type,
        )
      : this.devices
      ).forEach((device) => {
        device.update(newData)
      })
      return data
    }
