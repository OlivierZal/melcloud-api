import type { DeviceFacade, ZoneFacade } from '../facades/index.ts'
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
  typedFromEntries,
} from '../utils.ts'

/**
 * Method decorator factory that propagates data changes to device models after
 * the decorated method completes. Supports filtering by device type and handles
 * the special `SetPower` method name for power state updates.
 * @param root0 - Options object.
 * @param root0.type - Optional device type to filter which devices are updated.
 * @returns A method decorator that updates device models after execution.
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
    async function newTarget(this: ZoneFacade, ...args: unknown[]) {
      const [arg] = args
      if (
        arg !== null &&
        typeof arg === 'object' &&
        Object.keys(arg).length === 0
      ) {
        throw new Error('No data to set')
      }
      const data = await target.call(this, arg)

      /*
       * SetPower takes a boolean directly, not an object. For other methods,
       * filter out null/undefined values to avoid clearing fields unintentionally.
       */
      const newData =
        String(context.name) === 'setPower' ?
          { Power: arg }
        : Object.fromEntries(
            Object.entries(arg ?? data).filter(
              ([, value]) => value !== undefined && value !== null,
            ),
          )

      const targetDevices =
        type === undefined ?
          this.devices
        : this.devices.filter(({ type: deviceType }) => deviceType === type)
      for (const device of targetDevices) {
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
  const allEntries = Object.entries(newData)
  let entries = allEntries
  if (effectiveFlags !== FLAG_UNCHANGED) {
    const effectiveFlagsBigInt = BigInt(effectiveFlags)
    entries = allEntries.filter(
      ([key]) =>
        isUpdateDeviceData(flags, key) &&
        Boolean(BigInt(flags[key]) & effectiveFlagsBigInt),
    )
  }
  return typedFromEntries<Partial<ListDeviceData<T>>>(
    type === DeviceType.Ata ?
      entries.map(([key, value]) =>
        isSetDeviceDataAtaNotInList(key) ?
          [fromSetToListAta[key], value]
        : [key, value],
      )
    : entries,
  )
}

/**
 * Method decorator that converts API response data back to list format
 * and updates the device model, using effective flags to determine which fields changed.
 * @param target - The original method to wrap.
 * @param _context - Decorator context provided by the runtime.
 * @returns A wrapper that updates the device model after calling the original method.
 */
export const updateDevice = <
  T extends DeviceType,
  TData extends GetDeviceData<T> | SetDeviceData<T>,
>(
  target: (...args: any[]) => Promise<TData>,
  _context: ClassMethodDecoratorContext,
): ((...args: unknown[]) => Promise<TData>) =>
  async function newTarget(this: DeviceFacade<T>, ...args: unknown[]) {
    const data = await target.call(this, ...args)
    const {
      devices: [device],
    } = this
    if (device?.type === this.type) {
      device.update(convertToListDeviceData(this, data))
    }
    return data
  }
