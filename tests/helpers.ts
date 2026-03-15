import { vi } from 'vitest'

import type { DeviceType } from '../src/constants.ts'
import type { DeviceModelAny } from '../src/models/interfaces.ts'
import type { APIAdapter } from '../src/services/index.ts'

/**
 * Unsafe cast using overloading to bypass `no-unsafe-type-assertion`.
 * @param value - The value to cast.
 */
export function cast(value: unknown): never
export function cast(value: unknown): unknown {
  return value
}

/**
 * Create a mock object typed as `T` from a partial value.
 * Uses function overloading to avoid unsafe type assertions in tests.
 * @param value
 */
export function mock<T extends object>(value?: Partial<T>): T
export function mock(value: unknown = {}): unknown {
  return value
}

export const createMockApi = (
  overrides: Partial<APIAdapter> = {},
): APIAdapter =>
  mock<APIAdapter>({
    energy: vi.fn(),
    errorLog: vi.fn(),
    errors: vi.fn(),
    fetch: vi.fn().mockResolvedValue([]),
    frostProtection: vi.fn().mockResolvedValue({ data: { FPEnabled: false } }),
    group: vi.fn(),
    holidayMode: vi.fn().mockResolvedValue({ data: { HMEnabled: false } }),
    hourlyTemperatures: vi.fn(),
    internalTemperatures: vi.fn(),
    onSync: vi.fn().mockImplementation(async () => {}),
    operationModes: vi.fn(),
    setFrostProtection: vi.fn().mockResolvedValue({ data: { Success: true } }),
    setGroup: vi.fn(),
    setHolidayMode: vi.fn().mockResolvedValue({ data: { Success: true } }),
    setPower: vi.fn().mockResolvedValue({ data: true }),
    setValues: vi.fn(),
    signal: vi.fn().mockResolvedValue({
      data: { Data: [[{ Data: [-60], Name: 'Device' }]], Labels: ['12:00'] },
    }),
    temperatures: vi.fn(),
    tiles: vi.fn().mockResolvedValue({ data: {} }),
    values: vi.fn(),
    ...overrides,
  })

/**
 * Narrow a `DeviceModelAny` to a specific `DeviceModel<T>` via assertion.
 * @param device
 * @param type
 */
export function assertDeviceType<T extends DeviceType>(
  device: DeviceModelAny | undefined,
  type: T,
): asserts device is Extract<DeviceModelAny, { type: T }>
export function assertDeviceType(
  device: DeviceModelAny | undefined,
  type: DeviceType,
): void {
  if (device?.type !== type) {
    throw new Error(
      `Expected device of type ${String(type)}, got ${device ? String(device.type) : 'undefined'}`,
    )
  }
}
