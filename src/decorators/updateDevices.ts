import type { DeviceType } from '../enums.js'
import type { ISuperDeviceFacade } from '../facades/interfaces.js'
import type { FailureData, GroupAtaState, SuccessData } from '../types/index.js'

export const updateDevices =
  <T extends boolean | FailureData | GroupAtaState | SuccessData>(params?: {
    type?: keyof typeof DeviceType
  }) =>
  (
    target: (...args: any[]) => Promise<T>,
    context: ClassMethodDecoratorContext,
  ): ((...args: unknown[]) => Promise<T>) =>
    async function newTarget(this: ISuperDeviceFacade, ...args: unknown[]) {
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
      ;(params?.type ?
        this.devices.filter(
          ({ type: deviceType }) => deviceType === params.type,
        )
      : this.devices
      ).forEach((device) => {
        device.update(newData)
      })
      return data
    }
