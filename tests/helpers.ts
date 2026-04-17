import { vi } from 'vitest'

import type {
  ClassicAPIAdapter,
  Logger,
  SettingManager,
} from '../src/api/index.ts'
import type { ClassicDeviceType } from '../src/constants.ts'
import type {
  ClassicAreaDataAny,
  ClassicBuildingData,
  ClassicFloorData,
  ClassicListDeviceAny,
} from '../src/types/index.ts'
import {
  type ClassicDeviceAny,
  ClassicRegistry,
} from '../src/entities/index.ts'
import { HttpError } from '../src/http/index.ts'

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

const HTTP_OK = 200

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
        Data: [[{ Data: [MOCK_RSSI], Name: 'ClassicDevice' }]],
        Labels: ['12:00'],
      },
    }),
    getTemperatures: vi.fn(),
    getTiles: vi.fn().mockResolvedValue({ data: {} }),
    getValues: vi.fn(),
    onSync: vi.fn(),
    updateFrostProtection: vi
      .fn()
      .mockResolvedValue({ data: { Success: true } }),
    updateGroupState: vi.fn(),
    updateHolidayMode: vi.fn().mockResolvedValue({ data: { Success: true } }),
    updatePower: vi.fn().mockResolvedValue({ data: true }),
    updateValues: vi.fn(),
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

export function assertDeviceType<T extends ClassicDeviceType>(
  device: ClassicDeviceAny | undefined,
  type: T,
): asserts device is Extract<ClassicDeviceAny, { type: T }>
export function assertDeviceType(
  device: ClassicDeviceAny | undefined,
  type: ClassicDeviceType,
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
 * `new ClassicRegistry() + syncBuildings + syncFloors + syncAreas + classicSyncDevices`
 * pattern found in multiple test files.
 * @param data - Flat arrays of buildings, floors, areas, and devices.
 * @param data.areas - ClassicArea rows to sync.
 * @param data.buildings - ClassicBuilding rows to sync.
 * @param data.devices - ClassicDevice rows to sync.
 * @param data.floors - ClassicFloor rows to sync.
 * @returns A fully synced `ClassicRegistry` instance.
 */
export const createPopulatedRegistry = ({
  areas,
  buildings,
  devices,
  floors,
}: {
  areas: ClassicAreaDataAny[]
  buildings: ClassicBuildingData[]
  devices: ClassicListDeviceAny[]
  floors: ClassicFloorData[]
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
  status = HTTP_OK,
): {
  data: unknown
  headers: Record<string, string | string[]>
  status: number
} => ({
  data,
  headers,
  status,
})

/*
 * The Response constructor rejects a non-null body on the "null body"
 * statuses defined in the Fetch spec. Listed explicitly so mocked
 * fetches can model those responses without hitting the guard.
 */
const HTTP_SWITCHING_PROTOCOLS = 101
const HTTP_EARLY_HINTS = 103
const HTTP_NO_CONTENT = 204
const HTTP_RESET_CONTENT = 205
const HTTP_NOT_MODIFIED = 304
const NULL_BODY_STATUSES: ReadonlySet<number> = new Set([
  HTTP_EARLY_HINTS,
  HTTP_NO_CONTENT,
  HTTP_NOT_MODIFIED,
  HTTP_RESET_CONTENT,
  HTTP_SWITCHING_PROTOCOLS,
])

const buildMockHeaders = (
  headers: Record<string, string | string[]>,
): Headers => {
  const result = new Headers()
  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        result.append(key, item)
      }
    } else {
      result.set(key, value)
    }
  }
  return result
}

const serializeBody = (body: unknown): string => {
  if (typeof body === 'string') {
    return body
  }
  return JSON.stringify(body)
}

/**
 * Build a fetch-compatible Response mock. The token-auth flow uses
 * `fetch()` directly (not the internal HttpClient) and relies on the
 * Response surface: `.status`, `.ok`, `.text()`, `.headers.get()`, and
 * `.headers.getSetCookie()`.
 * @param body - Response body; objects are JSON-serialised, strings pass
 *   through.
 * @param headers - Response headers; `set-cookie` may be an array.
 * @param status - Response status (defaults to 200).
 * @returns A minimal `Response` object sufficient for the token-auth
 *   flow tests.
 */
export const mockFetchResponse = (
  body: unknown,
  headers: Record<string, string | string[]> = {},
  status = HTTP_OK,
): Response => {
  const responseHeaders = buildMockHeaders(headers)
  if (
    typeof body === 'object' &&
    body !== null &&
    !responseHeaders.has('content-type')
  ) {
    responseHeaders.set('content-type', 'application/json')
  }
  return new Response(
    NULL_BODY_STATUSES.has(status) ? null : serializeBody(body),
    { headers: responseHeaders, status },
  )
}

export const createHttpError = ({
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
}): HttpError =>
  new HttpError(
    message,
    { data: {}, headers: responseHeaders, status },
    { method, url },
  )

export const createServerError = (status: number, url = '/test'): HttpError =>
  createHttpError({ message: `Status ${String(status)}`, status, url })

export const createUnauthorizedError = (url = '/test'): HttpError =>
  createHttpError({ message: 'Unauthorized', status: 401, url })
