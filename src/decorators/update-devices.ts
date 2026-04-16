import type {
  ClassicDeviceFacade,
  ClassicZoneFacade,
} from '../facades/index.ts'
import type {
  ClassicFailureData,
  ClassicGetDeviceData,
  ClassicGroupState,
  ClassicListDeviceData,
  ClassicSetDeviceData,
  ClassicSuccessData,
} from '../types/index.ts'
import { CLASSIC_FLAG_UNCHANGED, ClassicDeviceType } from '../constants.ts'
import { NoChangesError } from '../errors/index.ts'
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
export const classicUpdateDevices =
  <
    T extends
      | boolean
      | ClassicFailureData
      | ClassicGroupState
      | ClassicSuccessData,
  >({
    type,
  }: {
    type?: ClassicDeviceType
  } = {}) =>
  (
    target: (...args: any[]) => Promise<T>,
    context: ClassMethodDecoratorContext,
  ): ((...args: unknown[]) => Promise<T>) =>
    async function newTarget(this: ClassicZoneFacade, ...args: unknown[]) {
      const [arg] = args
      if (
        arg !== null &&
        typeof arg === 'object' &&
        Object.keys(arg).length === 0
      ) {
        throw new NoChangesError(this.id)
      }
      const data = await target.call(this, arg)

      /*
       * SetPower takes a boolean directly, not an object. For other methods,
       * filter out null/undefined values to avoid clearing fields unintentionally.
       */
      const newData =
        String(context.name) === 'updatePower' ?
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
 * EffectiveFlags from the Classic API response indicates which fields were actually
 * changed by the device. Use this to update only those fields, converting
 * ATA set-command keys back to list-data keys (e.g., SetFanSpeed → ClassicFanSpeed).
 */
const convertToListDeviceData = <T extends ClassicDeviceType>(
  facade: ClassicDeviceFacade<T>,
  data: ClassicSetDeviceData<T>,
): Partial<ClassicListDeviceData<T>> => {
  const { flags, type } = facade
  const { EffectiveFlags: effectiveFlags, ...newData } = data
  const allEntries = Object.entries(newData)
  const effectiveFlagsBigInt =
    effectiveFlags === CLASSIC_FLAG_UNCHANGED ? null : BigInt(effectiveFlags)
  const entries =
    effectiveFlagsBigInt === null ? allEntries : (
      allEntries.filter(
        ([key]) =>
          isUpdateDeviceData(flags, key) &&
          Boolean(BigInt(flags[key]) & effectiveFlagsBigInt),
      )
    )
  return typedFromEntries<Partial<ClassicListDeviceData<T>>>(
    type === ClassicDeviceType.Ata ?
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
export const classicUpdateDevice = <
  T extends ClassicDeviceType,
  TData extends ClassicGetDeviceData<T> | ClassicSetDeviceData<T>,
>(
  target: (...args: any[]) => Promise<TData>,
  _context: ClassMethodDecoratorContext,
): ((...args: unknown[]) => Promise<TData>) =>
  async function newTarget(this: ClassicDeviceFacade<T>, ...args: unknown[]) {
    const data = await target.call(this, ...args)
    const {
      devices: [device],
    } = this
    if (device?.type === this.type) {
      device.update(convertToListDeviceData(this, data))
    }
    return data
  }
