import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ClassicAPI } from '../../src/api/classic.ts'
import type { SyncCallback } from '../../src/api/index.ts'
import { ClassicDeviceType } from '../../src/constants.ts'
import { ClassicFacadeManager } from '../../src/facades/classic-manager.ts'
import { HttpClient } from '../../src/http/client.ts'
import { HttpError } from '../../src/http/index.ts'
import {
  type ClassicBuildingWithStructure,
  toClassicAreaId,
  toClassicBuildingId,
  toClassicDeviceId,
  toClassicFloorId,
} from '../../src/types/index.ts'
import { ataDeviceData, buildingData } from '../fixtures.ts'
import { cast, defined, mock } from '../helpers.ts'

const transientError = (status: number): HttpError =>
  new HttpError(
    `Status ${String(status)}`,
    { data: {}, headers: {}, status },
    { url: '/User/ListDevices' },
  )

const buildingResponse: ClassicBuildingWithStructure[] = [
  mock<ClassicBuildingWithStructure>({
    ...buildingData({
      HMDefined: true,
      Location: 0,
      Name: 'Home',
      TimeZone: 1,
    }),
    Structure: {
      Areas: [],
      Devices: [],
      Floors: [
        {
          Areas: [
            {
              BuildingId: toClassicBuildingId(1),
              Devices: [
                {
                  AreaID: toClassicAreaId(100),
                  BuildingID: toClassicBuildingId(1),
                  Device: ataDeviceData({
                    NumberOfFanSpeeds: 5,
                    SetTemperature: 23,
                  }),
                  DeviceID: toClassicDeviceId(1001),
                  DeviceName: 'AC unit',
                  FloorID: toClassicFloorId(10),
                  Type: ClassicDeviceType.Ata,
                },
              ],
              FloorId: 10,
              ID: 100,
              Name: 'Living room',
            },
          ],
          BuildingId: toClassicBuildingId(1),
          Devices: [],
          ID: 10,
          Name: 'Ground floor',
        },
      ],
    },
  }),
]

const mockHttpClient = new HttpClient({
  baseURL: 'https://app.melcloud.com/Mitsubishi.Wifi.Client',
  timeout: 30_000,
})
const mockRequest = vi.spyOn(mockHttpClient, 'request')

describe('api lifecycle', () => {
  let melCloudApi: typeof ClassicAPI = cast(null)

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockRequest.mockResolvedValue({
      data: buildingResponse,
      headers: {},
      status: 200,
    })
    ;({ ClassicAPI: melCloudApi } = await import('../../src/api/classic.ts'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('creates ClassicAPI, syncs buildings, and populates the registry', async () => {
    const api = await melCloudApi.create({
      autoSyncInterval: 0,
      httpClient: mockHttpClient,
    })

    expect(api.registry.getDevices()).toHaveLength(1)
    expect(
      api.registry.getDevicesByBuildingId(toClassicBuildingId(1)),
    ).toHaveLength(1)
    expect(
      api.registry.getFloorsByBuildingId(toClassicBuildingId(1)),
    ).toHaveLength(1)
    expect(api.registry.getAreasByFloorId(toClassicFloorId(10))).toHaveLength(1)
    expect(api.registry.getDevicesByAreaId(toClassicAreaId(100))).toHaveLength(
      1,
    )

    const device = api.registry.devices.getById(1001)

    expect(device).toBeDefined()
    expect(defined(device).name).toBe('AC unit')
    expect(defined(device).type).toBe(ClassicDeviceType.Ata)

    /*
     * Inline snapshot on the registry summary after initial sync.
     * Captures building → floor → area → device hierarchy shape
     * without being brittle on device-data fields.
     */
    expect(
      api.registry.getBuildings().map(({ floors, name }) => ({
        floors: floors.map(({ areas, name: floorName }) => ({
          areas: areas.map(({ devices, name: areaName }) => ({
            devices: devices.map(({ name: deviceName }) => deviceName),
            name: areaName,
          })),
          name: floorName,
        })),
        name,
      })),
    ).toMatchInlineSnapshot(`
      [
        {
          "floors": [
            {
              "areas": [
                {
                  "devices": [
                    "AC unit",
                  ],
                  "name": "Living room",
                },
              ],
              "name": "Ground floor",
            },
          ],
          "name": "Home",
        },
      ]
    `)
  })

  it('facadeManager works with registry populated by ClassicAPI', async () => {
    const api = await melCloudApi.create({
      autoSyncInterval: 0,
      httpClient: mockHttpClient,
    })
    const manager = new ClassicFacadeManager(api, api.registry)

    const building = defined(api.registry.buildings.getById(1))
    const facade = manager.get(building)

    expect(facade.name).toBe('Home')
    expect(facade.devices).toHaveLength(1)
    expect(defined(facade.devices[0]).name).toBe('AC unit')
  })

  it('authenticate → fetch → registry reflects updated data', async () => {
    mockRequest.mockResolvedValue({ data: [], headers: {}, status: 200 })
    const api = await melCloudApi.create({
      autoSyncInterval: 0,
      httpClient: mockHttpClient,
    })

    expect(api.registry.getDevices()).toHaveLength(0)

    // Simulate authentication returning login data, then fetch returns buildings
    mockRequest.mockImplementation(async (config) => {
      await Promise.resolve()
      if (config.url === '/Login/ClientLogin3') {
        return {
          data: {
            LoginData: {
              ContextKey: 'ctx-123',
              Expiry: '2099-12-31T00:00:00',
            },
          },
          headers: {},
          status: 200,
        }
      }
      return { data: buildingResponse, headers: {}, status: 200 }
    })

    await api.authenticate({ password: 'pass', username: 'user@test.com' })

    // Registry should now be populated after the post-auth fetch
    expect(api.registry.getDevices()).toHaveLength(1)
    expect(defined(api.registry.buildings.getById(1)).name).toBe('Home')
  })

  it('settingManager persists credentials across ClassicAPI operations', async () => {
    const store = new Map<string, string | null | undefined>()
    const settingManager = {
      get: vi.fn<(key: string) => string | null | undefined>((key) =>
        store.get(key),
      ),
      set: vi.fn<(key: string, value: string | null | undefined) => void>(
        (key, value) => {
          store.set(key, value)
        },
      ),
    }

    mockRequest.mockImplementation(async (config) => {
      await Promise.resolve()
      if (config.url === '/Login/ClientLogin3') {
        return {
          data: {
            LoginData: {
              ContextKey: 'ctx-abc',
              Expiry: '2099-12-31T00:00:00',
            },
          },
          headers: {},
          status: 200,
        }
      }
      return { data: buildingResponse, headers: {}, status: 200 }
    })

    const api = await melCloudApi.create({
      autoSyncInterval: 0,
      httpClient: mockHttpClient,
      settingManager,
    })

    await api.authenticate({ password: 'secret', username: 'me@test.com' })

    // Verify credentials were persisted
    expect(settingManager.set).toHaveBeenCalledWith('username', 'me@test.com')
    expect(settingManager.set).toHaveBeenCalledWith('password', 'secret')
    expect(settingManager.set).toHaveBeenCalledWith('contextKey', 'ctx-abc')
    expect(settingManager.set).toHaveBeenCalledWith(
      'expiry',
      '2099-12-31T00:00:00',
    )
  })

  it('re-sync replaces registry data', async () => {
    const api = await melCloudApi.create({
      autoSyncInterval: 0,
      httpClient: mockHttpClient,
    })

    expect(api.registry.getDevices()).toHaveLength(1)

    // Next fetch returns empty buildings
    mockRequest.mockResolvedValue({ data: [], headers: {}, status: 200 })
    await api.fetch()

    expect(api.registry.getDevices()).toHaveLength(0)
    expect(
      api.registry.getFloorsByBuildingId(toClassicBuildingId(1)),
    ).toHaveLength(0)
  })

  it('onSync callback is invoked after fetch', async () => {
    const onSync = vi.fn<SyncCallback>()
    await melCloudApi.create({
      autoSyncInterval: 0,
      httpClient: mockHttpClient,
      onSync,
    })

    expect(onSync).toHaveBeenCalledWith(expect.objectContaining({}))
  })

  /*
   * End-to-end resilience: exercises the `withRetryBackoff` wrapper
   * around `list()` (the classic heartbeat) to confirm a transient
   * 5xx is recovered without the consumer seeing it.
   */
  describe('resilience end-to-end', () => {
    it('recovers from a transient 503 on fetch via exponential backoff', async () => {
      const api = await melCloudApi.create({
        autoSyncInterval: 0,
        httpClient: mockHttpClient,
      })
      mockRequest.mockClear()
      mockRequest
        .mockRejectedValueOnce(transientError(503))
        .mockResolvedValueOnce({
          data: buildingResponse,
          headers: {},
          status: 200,
        })

      const fetchPromise = api.fetch()
      await vi.advanceTimersByTimeAsync(2000)
      const buildings = await fetchPromise

      expect(buildings).toHaveLength(1)
      expect(mockRequest).toHaveBeenCalledTimes(2)
      expect(api.registry.getDevices()).toHaveLength(1)
    })

    it('gives up after exhausting the 5xx retry budget and returns empty data', async () => {
      const api = await melCloudApi.create({
        autoSyncInterval: 0,
        httpClient: mockHttpClient,
      })
      mockRequest.mockClear()
      mockRequest
        .mockRejectedValueOnce(transientError(502))
        .mockRejectedValueOnce(transientError(503))
        .mockRejectedValueOnce(transientError(504))
        .mockRejectedValueOnce(transientError(502))
        .mockRejectedValueOnce(transientError(503))

      const fetchPromise = api.fetch()
      await vi.advanceTimersByTimeAsync(60_000)
      const buildings = await fetchPromise

      /*
       * `fetch()` catches the final rejection and returns `[]` so the
       * Homey app's sync loop keeps running through an outage — the
       * registry just reflects what was last known.
       */
      expect(buildings).toStrictEqual([])
      // 1 initial attempt + 4 retries = 5 total.
      expect(mockRequest).toHaveBeenCalledTimes(5)
    })
  })
})
