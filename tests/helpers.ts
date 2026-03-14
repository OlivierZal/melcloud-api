import type { DeviceType } from '../src/constants.ts'
import type { DeviceModel, DeviceModelAny } from '../src/models/interfaces.ts'

/**
 * Create a mock object typed as `T` from a partial value.
 * Uses function overloading to avoid unsafe type assertions in tests.
 */
export function mock<T extends object>(value?: Partial<T>): T
export function mock(value: unknown = {}): unknown {
  return value
}

/** Narrow a `DeviceModelAny` to a specific `DeviceModel<T>` via assertion. */
export const assertDeviceType = <T extends DeviceType>(
  device: DeviceModelAny | undefined,
  type: T,
): asserts device is DeviceModel<T> => {
  if (device?.type !== type) {
    throw new Error(
      `Expected device of type ${String(type)}, got ${device ? String(device.type) : 'undefined'}`,
    )
  }
}
