import {
  FLAG_UNCHANGED,
  fromSetToListAta,
  type DeviceType,
  type GetDeviceData,
  type KeysOfSetDeviceDataAtaNotInList,
  type ListDevice,
  type SetDeviceData,
  type UpdateDeviceData,
} from '../types/index.js'

import type { BaseDeviceFacade } from '../facades/index.js'
import type { DeviceModel } from '../models/index.js'

const convertToListDeviceData = <T extends keyof typeof DeviceType>(
  facade: BaseDeviceFacade<T>,
  data: SetDeviceData[T],
): Partial<ListDevice[T]['Device']> => {
  const { EffectiveFlags: flags, ...newData } = data
  const entries =
    flags === FLAG_UNCHANGED ?
      Object.entries(newData)
    : Object.entries(newData).filter(
        ([key]) =>
          key in facade.flags &&
          Number(
            BigInt(facade.flags[key as keyof UpdateDeviceData[T]]) &
              BigInt(flags),
          ),
      )
  return Object.fromEntries(
    facade.type === 'Ata' ?
      entries.map(([key, value]) =>
        key in fromSetToListAta ?
          [fromSetToListAta[key as KeysOfSetDeviceDataAtaNotInList], value]
        : [key, value],
      )
    : entries,
  ) as Partial<ListDevice[T]['Device']>
}

export const updateDevice = <
  T extends keyof typeof DeviceType,
  DeviceData extends GetDeviceData[T] | SetDeviceData[T],
>(
  target: (...args: any[]) => Promise<DeviceData>,
  _context: ClassMethodDecoratorContext,
): ((...args: unknown[]) => Promise<DeviceData>) =>
  async function newTarget(this: BaseDeviceFacade<T>, ...args: unknown[]) {
    const data = await target.call(this, ...args)
    ;(this.instance as DeviceModel<T>).update(
      convertToListDeviceData(this, data),
    )
    return data
  }
