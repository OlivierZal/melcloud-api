import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ClassicAPI } from '../../src/api/classic.ts'
import type {
  AreaID,
  BuildingID,
  BuildingWithStructure,
  DeviceID,
  FloorID,
} from '../../src/types/index.ts'
import { DeviceType } from '../../src/constants.ts'
import { ClassicFacadeManager } from '../../src/facades/classic-manager.ts'
import { ataDeviceData, buildingData } from '../fixtures.ts'
import { cast, defined, mock } from '../helpers.ts'

const transientError = (status: number): Error =>
  Object.assign(new Error(`Status ${String(status)}`), {
    config: { url: '/User/ListDevices' },
    isAxiosError: true,
    response: { data: undefined, headers: {}, status },
  })

const buildingResponse: BuildingWithStructure[] = [
  mock<BuildingWithStructure>({
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
              BuildingId: 1 as BuildingID,
              Devices: [
                {
                  AreaID: 100 as AreaID,
                  BuildingID: 1 as BuildingID,
                  Device: ataDeviceData({
                    NumberOfFanSpeeds: 5,
                    SetTemperature: 23,
                  }),
                  DeviceID: 1001 as DeviceID,
                  DeviceName: 'AC unit',
                  FloorID: 10 as FloorID,
                  Type: DeviceType.Ata,
                },
              ],
              FloorId: 10,
              ID: 100,
              Name: 'Living room',
            },
          ],
          BuildingId: 1 as BuildingID,
          Devices: [],
          ID: 10,
          Name: 'Ground floor',
        },
      ],
    },
  }),
]

const mockInterceptors = {
  request: { use: vi.fn() },
  response: { use: vi.fn() },
}
const mockAxiosInstance = {
  get: vi.fn(),
  interceptors: mockInterceptors,
  post: vi.fn(),
  request: vi.fn(),
}

vi.mock(import('axios'), async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    default: cast({
      create: vi.fn().mockReturnValue(mockAxiosInstance),
      isAxiosError: original.default.isAxiosError,
    }),
  }
})

describe('api lifecycle', () => {
  let melCloudApi: typeof ClassicAPI = cast(null)

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockAxiosInstance.get.mockResolvedValue({ data: buildingResponse })
    mockAxiosInstance.post.mockResolvedValue({ data: [] })
    ;({ ClassicAPI: melCloudApi } = await import('../../src/api/classic.ts'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('creates ClassicAPI, syncs buildings, and populates the registry', async () => {
    const api = await melCloudApi.create({ autoSyncInterval: 0 })

    expect(api.registry.getDevices()).toHaveLength(1)
    expect(api.registry.getDevicesByBuildingId(1 as BuildingID)).toHaveLength(1)
    expect(api.registry.getFloorsByBuildingId(1 as BuildingID)).toHaveLength(1)
    expect(api.registry.getAreasByFloorId(10 as FloorID)).toHaveLength(1)
    expect(api.registry.getDevicesByAreaId(100 as AreaID)).toHaveLength(1)

    const device = api.registry.devices.getById(1001)

    expect(device).toBeDefined()
    expect(defined(device).name).toBe('AC unit')
    expect(defined(device).type).toBe(DeviceType.Ata)

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
    const api = await melCloudApi.create({ autoSyncInterval: 0 })
    const manager = new ClassicFacadeManager(api, api.registry)

    const building = defined(api.registry.buildings.getById(1))
    const facade = manager.get(building)

    expect(facade.name).toBe('Home')
    expect(facade.devices).toHaveLength(1)
    expect(defined(facade.devices[0]).name).toBe('AC unit')
  })

  it('authenticate → fetch → registry reflects updated data', async () => {
    mockAxiosInstance.get.mockResolvedValue({ data: [] })
    const api = await melCloudApi.create({ autoSyncInterval: 0 })

    expect(api.registry.getDevices()).toHaveLength(0)

    // Simulate authentication returning login data
    mockAxiosInstance.post.mockResolvedValue({
      data: {
        LoginData: { ContextKey: 'ctx-123', Expiry: '2099-12-31T00:00:00' },
      },
    })
    // After auth, fetch returns buildings
    mockAxiosInstance.get.mockResolvedValue({ data: buildingResponse })

    await api.authenticate({ password: 'pass', username: 'user@test.com' })

    // Registry should now be populated after the post-auth fetch
    expect(api.registry.getDevices()).toHaveLength(1)
    expect(defined(api.registry.buildings.getById(1)).name).toBe('Home')
  })

  it('settingManager persists credentials across ClassicAPI operations', async () => {
    const store = new Map<string, string | null | undefined>()
    const settingManager = {
      get: vi.fn((key: string) => store.get(key)),
      set: vi.fn((key: string, value: string | null | undefined) => {
        store.set(key, value)
      }),
    }

    mockAxiosInstance.post.mockResolvedValue({
      data: {
        LoginData: { ContextKey: 'ctx-abc', Expiry: '2099-12-31T00:00:00' },
      },
    })
    mockAxiosInstance.get.mockResolvedValue({ data: buildingResponse })

    const api = await melCloudApi.create({
      autoSyncInterval: 0,
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
    const api = await melCloudApi.create({ autoSyncInterval: 0 })

    expect(api.registry.getDevices()).toHaveLength(1)

    // Next fetch returns empty buildings
    mockAxiosInstance.get.mockResolvedValue({ data: [] })
    await api.fetch()

    expect(api.registry.getDevices()).toHaveLength(0)
    expect(api.registry.getFloorsByBuildingId(1 as BuildingID)).toHaveLength(0)
  })

  it('onSync callback is invoked after fetch', async () => {
    const onSync = vi.fn()
    await melCloudApi.create({ autoSyncInterval: 0, onSync })

    expect(onSync).toHaveBeenCalledWith(expect.objectContaining({}))
  })

  /*
   * End-to-end resilience: exercises the `withRetryBackoff` wrapper
   * around `list()` (the classic heartbeat) to confirm a transient
   * 5xx is recovered without the consumer seeing it. Gate-closure
   * and reactive 401 re-auth interactions are covered by unit tests
   * that can drive the interceptor chain directly; the mocked axios
   * instance here bypasses interceptors, so only scenarios that
   * retry at the `list()` level can be asserted end-to-end.
   */
  describe('resilience end-to-end', () => {
    it('recovers from a transient 503 on fetch via exponential backoff', async () => {
      const api = await melCloudApi.create({ autoSyncInterval: 0 })
      mockAxiosInstance.get.mockClear()
      mockAxiosInstance.get
        .mockRejectedValueOnce(transientError(503))
        .mockResolvedValueOnce({ data: buildingResponse })

      const fetchPromise = api.fetch()
      await vi.advanceTimersByTimeAsync(2000)
      const buildings = await fetchPromise

      expect(buildings).toHaveLength(1)
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2)
      expect(api.registry.getDevices()).toHaveLength(1)
    })

    it('gives up after exhausting the 5xx retry budget and returns empty data', async () => {
      const api = await melCloudApi.create({ autoSyncInterval: 0 })
      mockAxiosInstance.get.mockClear()
      mockAxiosInstance.get
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
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(5)
    })
  })
})
