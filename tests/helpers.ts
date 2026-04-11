import { vi } from 'vitest'

import type { APIAdapter, SettingManager } from '../src/api/index.ts'
import type { DeviceType } from '../src/constants.ts'
import type { DeviceModelAny } from '../src/models/index.ts'

const MOCK_RSSI = -60

export function cast(value: unknown): never
export function cast(value: unknown): unknown {
  return value
}

export const defined = <T>(value: T | null | undefined): T => {
  if (value === undefined || value === null) {
    throw new Error('Expected value to be defined')
  }
  return value
}

export function mock<T extends object>(value?: Partial<T>): T
export function mock(value: unknown = {}): unknown {
  return value
}

export const createMockApi = (
  overrides: Partial<APIAdapter> = {},
): APIAdapter =>
  mock<APIAdapter>({
    fetch: vi.fn().mockResolvedValue([]),
    getEnergy: vi.fn(),
    getErrorEntries: vi.fn(),
    getErrorLog: vi.fn(),
    getFrostProtection: vi
      .fn()
      .mockResolvedValue({ data: { FPEnabled: false } }),
    getGroup: vi.fn(),
    getHolidayMode: vi.fn().mockResolvedValue({ data: { HMEnabled: false } }),
    getHourlyTemperatures: vi.fn(),
    getInternalTemperatures: vi.fn(),
    getOperationModes: vi.fn(),
    getSignal: vi.fn().mockResolvedValue({
      data: {
        Data: [[{ Data: [MOCK_RSSI], Name: 'Device' }]],
        Labels: ['12:00'],
      },
    }),
    getTemperatures: vi.fn(),
    getTiles: vi.fn().mockResolvedValue({ data: {} }),
    getValues: vi.fn(),
    onSync: vi.fn(),
    setFrostProtection: vi.fn().mockResolvedValue({ data: { Success: true } }),
    setGroup: vi.fn(),
    setHolidayMode: vi.fn().mockResolvedValue({ data: { Success: true } }),
    setPower: vi.fn().mockResolvedValue({ data: true }),
    setValues: vi.fn(),
    ...overrides,
  })

export const createSettingStore = (
  initial: Record<string, string> = {},
): {
  setSpy: ReturnType<typeof vi.fn<(key: string, value: string) => void>>
  settingManager: SettingManager
} => {
  const store = new Map(Object.entries(initial))
  const setSpy = vi.fn((key: string, value: string) => {
    store.set(key, value)
  })
  return {
    setSpy,
    settingManager: {
      set: setSpy,
      get: (key: string) => store.get(key) ?? null,
    },
  }
}

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
