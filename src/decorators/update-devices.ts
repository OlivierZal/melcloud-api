import type { DeviceFacade, SuperDeviceFacade } from '../facades/index.ts'
import type { DeviceModelAny } from '../models/interfaces.ts'
import type {
  FailureData,
  GetDeviceData,
  GroupState,
  ListDeviceData,
  SetDeviceData,
  SuccessData,
} from '../types/index.ts'

import { DeviceType, FLAG_UNCHANGED } from '../constants.ts'
import {
  fromSetToListAta,
  isSetDeviceDataAtaNotInList,
  isUpdateDeviceData,
} from '../utils.ts'

const FIRST_DEVICE_INDEX = 0

const isDeviceOfType = (device: DeviceModelAny, type: DeviceType): boolean =>
  device.type === type

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

      /*
       * SetPower takes a boolean directly, not an object. For other methods,
       * filter out null/undefined values to avoid clearing fields unintentionally.
       */
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

/*
 * EffectiveFlags from the API response indicates which fields were actually
 * changed by the device. Use this to update only those fields, converting
 * ATA set-command keys back to list-data keys (e.g., SetFanSpeed → FanSpeed).
 */
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
    const device = this.devices.at(FIRST_DEVICE_INDEX)
    if (device && isDeviceOfType(device, this.type)) {
      /* eslint-disable @typescript-eslint/no-unsafe-type-assertion -- runtime-verified */
      ;(
        device as unknown as { update: (d: Partial<ListDeviceData<T>>) => void }
      ).update(convertToListDeviceData(this, data))
      /* eslint-enable @typescript-eslint/no-unsafe-type-assertion */
    }
    return data
  }
