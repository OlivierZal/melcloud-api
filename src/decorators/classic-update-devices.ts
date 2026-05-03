import type {
  ClassicDeviceFacade,
  ClassicZoneFacade,
} from '../facades/index.ts'
import type {
  ClassicFailureData,
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
 * How the decorator should compute the patch that gets propagated to
 * each device in scope:
 * - `'payload'` (default): use the method's request payload (the
 *   single first argument), filtering out `null`/`undefined` fields so
 *   callers can't accidentally clear existing values.
 * - `'power'`: specialisation for power-toggle methods whose argument
 *   is a bare `boolean` rather than an object. The boolean is wrapped
 *   into `{ Power: bool }` before the propagation step.
 *
 * Replacing the former `String(context.name) === 'updatePower'`
 * heuristic: a silent rename is no longer a latent bug.
 * @internal
 */
type UpdatePatchKind = 'payload' | 'power'

/**
 * Method decorator factory that propagates data changes to device
 * models after the decorated method completes. Supports filtering by
 * device type; the patch-computation strategy is explicit via
 * the `kind` option (`'payload'` or `'power'`) rather than inferred
 * from the method name.
 * @param root0 - Options object.
 * @param root0.kind - Patch-computation strategy (default `'payload'`).
 * @param root0.type - Optional device type to filter which devices
 * are updated. When omitted, every device in the facade is patched.
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
    kind = 'payload',
    type,
  }: {
    kind?: UpdatePatchKind
    type?: ClassicDeviceType
  } = {}) =>
  <TArgs extends readonly unknown[]>(
    target: (...args: TArgs) => Promise<T>,
    _context: ClassMethodDecoratorContext,
  ): ((...args: TArgs) => Promise<T>) =>
    async function newTarget(this: ClassicZoneFacade, ...args: TArgs) {
      const [arg] = args
      if (
        arg !== null &&
        typeof arg === 'object' &&
        Object.keys(arg).length === 0
      ) {
        throw new NoChangesError(this.id)
      }
      const data = await target.call(this, ...args)
      const newData =
        kind === 'power' ?
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

/**
 * EffectiveFlags from the Classic API response indicates which fields
 * were actually changed by the device. Use this to update only those
 * fields, converting ATA set-command keys back to list-data keys
 * (e.g., `SetFanSpeed` → `FanSpeed`). Exported for facade methods that
 * return Result and apply the registry update inline (e.g.,
 * `BaseDeviceFacade.getValues`).
 * @param facade - The facade whose registry device should be patched.
 * @param data - The Classic API set/get device payload.
 * @returns A list-data partial ready to feed `device.update(...)`.
 */
export const convertToListDeviceData = <T extends ClassicDeviceType>(
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

// The decorator handles raw-payload methods only. `getValues` returns
// `Result<...>` and applies its registry update inline on the success
// branch — keeping the decorator's input shape homogeneously raw
// preserves clean type narrowing here.
const updateSingleDevice = <
  T extends ClassicDeviceType,
  TArgs extends readonly unknown[],
  TData extends ClassicSetDeviceData<T>,
>(
  target: (...args: TArgs) => Promise<TData>,
  _context: ClassMethodDecoratorContext,
): ((...args: TArgs) => Promise<TData>) =>
  async function newTarget(this: ClassicDeviceFacade<T>, ...args: TArgs) {
    const data = await target.call(this, ...args)
    const {
      devices: [device],
    } = this
    if (device?.type === this.type) {
      device.update(convertToListDeviceData(this, data))
    }
    return data
  }

/**
 * Method decorator factory that converts the API response back to
 * list-data shape and updates the targeted device model, using
 * `EffectiveFlags` to propagate only fields the device actually
 * acknowledged.
 *
 * Factory form (always invoked as `@classicUpdateDevice()`) for
 * signature symmetry with {@link classicUpdateDevices}; the decorator
 * takes no configuration today but the shape is stable for future
 * options without breaking call sites.
 * @returns A method decorator.
 */
export const classicUpdateDevice = (): typeof updateSingleDevice =>
  updateSingleDevice
