import type {
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'
import { vi } from 'vitest'

import type { ClassicAPIAdapter, Logger, SettingManager } from '../src/api/index.ts'
import type { DeviceType } from '../src/constants.ts'
import type {
  AreaDataAny,
  BuildingData,
  FloorData,
  ListDeviceAny,
} from '../src/types/index.ts'
import { type DeviceAny, ClassicRegistry } from '../src/models/index.ts'

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
  overrides: Partial<ClassicAPIAdapter> = {},
): ClassicAPIAdapter =>
  mock<ClassicAPIAdapter>({
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
  device: DeviceAny | undefined,
  type: T,
): asserts device is Extract<DeviceAny, { type: T }>
export function assertDeviceType(
  device: DeviceAny | undefined,
  type: DeviceType,
): void {
  if (device?.type !== type) {
    throw new Error(
      `Expected device of type ${String(type)}, got ${device ? String(device.type) : 'undefined'}`,
    )
  }
}

/**
 * Build a `ClassicRegistry` populated with the provided hierarchy in a
 * single call. Replaces the repeated 5-line
 * `new ClassicRegistry() + syncBuildings + syncFloors + syncAreas + syncDevices`
 * pattern found in multiple test files.
 * @param data - Flat arrays of buildings, floors, areas, and devices.
 * @param data.areas - Area rows to sync.
 * @param data.buildings - Building rows to sync.
 * @param data.devices - Device rows to sync.
 * @param data.floors - Floor rows to sync.
 * @returns A fully synced `ClassicRegistry` instance.
 */
export const createPopulatedRegistry = ({
  areas,
  buildings,
  devices,
  floors,
}: {
  areas: AreaDataAny[]
  buildings: BuildingData[]
  devices: ListDeviceAny[]
  floors: FloorData[]
}): ClassicRegistry => {
  const registry = new ClassicRegistry()
  registry.syncBuildings(buildings)
  registry.syncFloors(floors)
  registry.syncAreas(areas)
  registry.syncDevices(devices)
  return registry
}

export const createLogger = (): Logger => ({
  error: vi.fn<(...data: unknown[]) => void>(),
  log: vi.fn<(...data: unknown[]) => void>(),
})

export const mockResponse = (
  data: unknown,
  headers: Record<string, string | string[]> = {},
  status = 200,
): {
  config: object
  data: unknown
  headers: Record<string, string | string[]>
  status: number
} => ({
  config: {},
  data,
  headers,
  status,
})

export const createAxiosError = ({
  message,
  method = 'get',
  responseHeaders = {},
  status,
  url,
}: {
  message: string
  status: number
  url: string
  method?: string
  responseHeaders?: Record<string, string>
}): AxiosError =>
  mock<AxiosError>({
    config: mock<InternalAxiosRequestConfig>({ method, url }),
    isAxiosError: true,
    message,
    response: mock<AxiosResponse>({
      config: mock<InternalAxiosRequestConfig>({ data: null, method, url }),
      data: {},
      headers: responseHeaders,
      status,
    }),
  })
