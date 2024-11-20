import { FLAG_UNCHANGED } from '../constants.js'
import { DeviceType } from '../enums.js'
import { fromSetToListAta } from '../utils.js'

import type { IDeviceFacade } from '../facades/interfaces.js'
import type { IDeviceModel } from '../models/interfaces.js'
import type {
  GetDeviceData,
  KeysOfSetDeviceDataAtaNotInList,
  ListDeviceData,
  SetDeviceData,
  UpdateDeviceData,
} from '../types/index.js'

const isKeysOfSetDeviceDataAtaNotInList = (
  key: string,
): key is KeysOfSetDeviceDataAtaNotInList => key in fromSetToListAta

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
        isKeysOfSetDeviceDataAtaNotInList(key) ?
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
