import { FLAG_UNCHANGED } from '../constants.js'
import { DeviceType } from '../enums.js'
import { fromSetToListAta, isKeyofSetDeviceDataAtaNotInList } from '../utils.js'

import type {
  IDeviceFacade,
  ISuperDeviceFacade,
} from '../facades/interfaces.js'
import type { IDeviceModel } from '../models/interfaces.js'
import type {
  FailureData,
  GetDeviceData,
  GroupAtaState,
  ListDeviceData,
  SetDeviceData,
  SuccessData,
  UpdateDeviceData,
} from '../types/index.js'

export const updateDevices =
  <T extends boolean | FailureData | GroupAtaState | SuccessData>(params?: {
    type?: DeviceType
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
      ;(params?.type === undefined ?
        this.devices
      : this.devices.filter(
          ({ type: deviceType }) => deviceType === params.type,
        )
      ).forEach((device) => {
        device.update(newData)
      })
      return data
    }

const convertToListDeviceData = <T extends DeviceType>(
  facade: IDeviceFacade<T>,
  data: SetDeviceData<T>,
): Partial<ListDeviceData<T>> => {
  const { EffectiveFlags: flags, ...newData } = data
  const entries =
    flags === FLAG_UNCHANGED ?
      Object.entries(newData)
    : Object.entries(newData).filter(
        ([key]) =>
          key in facade.flags &&
          Number(
            BigInt(facade.flags[key as keyof UpdateDeviceData<T>]) &
              BigInt(flags),
          ),
      )
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  return Object.fromEntries(
    facade.type === DeviceType.Ata ?
      entries.map(([key, value]) =>
        isKeyofSetDeviceDataAtaNotInList(key) ?
          [fromSetToListAta[key], value]
        : [key, value],
      )
    : entries,
  ) as Partial<ListDeviceData<T>>
}

export const updateDevice = <
  T extends DeviceType,
  U extends GetDeviceData<T> | SetDeviceData<T>,
>(
  target: (...args: any[]) => Promise<U>,
  _context: ClassMethodDecoratorContext,
): ((...args: unknown[]) => Promise<U>) =>
  async function newTarget(this: IDeviceFacade<T>, ...args: unknown[]) {
    const data = await target.call(this, ...args)
    const {
      devices: [device],
    } = this
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    ;(device as IDeviceModel<T>).update(convertToListDeviceData(this, data))
    return data
  }
