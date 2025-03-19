import { FLAG_UNCHANGED } from '../constants.ts'
import { DeviceType } from '../enums.ts'
import {
  fromSetToListAta,
  isSetDeviceDataAtaNotInList,
  isUpdateDeviceData,
} from '../utils.ts'

import type { IDeviceFacade, ISuperDeviceFacade } from '../facades/index.ts'
import type { IDeviceModel } from '../models/index.ts'
import type { GroupState } from '../types/ata.ts'
import type {
  FailureData,
  GetDeviceData,
  ListDeviceData,
  SetDeviceData,
  SuccessData,
} from '../types/common.ts'

export const updateDevices =
  <T extends boolean | FailureData | GroupState | SuccessData>({
    type,
  }: {
    type?: DeviceType
  } = {}) =>
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
      ;(type === undefined ?
        this.devices
      : this.devices.filter(({ type: deviceType }) => deviceType === type)
      ).forEach((device) => {
        device.update(newData)
      })
      return data
    }

const convertToListDeviceData = <T extends DeviceType>(
  facade: IDeviceFacade<T>,
  data: SetDeviceData<T>,
): Partial<ListDeviceData<T>> => {
  const { flags, type } = facade
  const { EffectiveFlags: effectiveFlags, ...newData } = data
  const entries =
    effectiveFlags === FLAG_UNCHANGED ?
      Object.entries(newData)
    : Object.entries(newData).filter(
        ([key]) =>
          isUpdateDeviceData(flags, key) &&
          Boolean(BigInt(flags[key]) & BigInt(effectiveFlags)),
      )
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  return Object.fromEntries(
    type === DeviceType.Ata ?
      entries.map(([key, value]) =>
        isSetDeviceDataAtaNotInList(key) ?
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
