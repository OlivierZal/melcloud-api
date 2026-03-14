import type { DeviceFacade, SuperDeviceFacade } from '../facades/index.ts'
import type { DeviceModel } from '../models/interfaces.ts'
import type {
  FailureData,
  GetDeviceData,
  GroupState,
  ListDeviceData,
  SetDeviceData,
  SuccessData,
} from '../types/index.ts'

import { FLAG_UNCHANGED } from '../constants.ts'
import { DeviceType } from '../enums.ts'
import {
  fromSetToListAta,
  isSetDeviceDataAtaNotInList,
  isUpdateDeviceData,
} from '../utils.ts'

/**
 * Method decorator factory that propagates data changes to device models after
 * the decorated method completes. Supports filtering by device type and handles
 * the special `SetPower` method name for power state updates.
 */
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
    async function newTarget(this: SuperDeviceFacade, ...args: unknown[]) {
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
      for (const device of type === undefined ?
        this.devices
      : this.devices.filter(({ type: deviceType }) => deviceType === type)) {
        device.update(newData)
      }
      return data
    }

const convertToListDeviceData = <T extends DeviceType>(
  facade: DeviceFacade<T>,
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

/**
 * Method decorator that converts API response data back to list format
 * and updates the device model, using effective flags to determine which fields changed.
 */
export const updateDevice = <
  T extends DeviceType,
  U extends GetDeviceData<T> | SetDeviceData<T>,
>(
  target: (...args: any[]) => Promise<U>,
  _context: ClassMethodDecoratorContext,
): ((...args: unknown[]) => Promise<U>) =>
  async function newTarget(this: DeviceFacade<T>, ...args: unknown[]) {
    const data = await target.call(this, ...args)
    const {
      devices: [device],
    } = this
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    ;(device as DeviceModel<T>).update(convertToListDeviceData(this, data))
    return data
  }
