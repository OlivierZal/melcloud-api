import type { AxiosStatic, HttpStatusCode } from 'axios'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Building, ListDeviceDataAta } from '../../src/types/index.ts'

import { DeviceType } from '../../src/constants.ts'
import { FacadeManager } from '../../src/facades/manager.ts'
import { mock } from '../helpers.ts'

const ataDeviceData = mock<ListDeviceDataAta>({
  ActualFanSpeed: 3,
  EffectiveFlags: 0,
  FanSpeed: 3,
  HasAutomaticFanSpeed: true,
  MaxTempAutomatic: 31,
  MaxTempCoolDry: 31,
  MaxTempHeat: 31,
  MinTempAutomatic: 16,
  MinTempCoolDry: 16,
  MinTempHeat: 10,
  NumberOfFanSpeeds: 5,
  OperationMode: 1,
  OutdoorTemperature: 20,
  Power: true,
  RoomTemperature: 22,
  SetTemperature: 23,
  VaneHorizontalDirection: 0,
  VaneVerticalDirection: 0,
})

const buildingResponse: Building[] = [
  {
    FPDefined: true,
    FPEnabled: false,
    FPMaxTemperature: 16,
    FPMinTemperature: 4,
    HMDefined: true,
    HMEnabled: false,
    HMEndDate: null,
    HMStartDate: null,
    ID: 1,
    Location: 0,
    Name: 'Home',
    Structure: {
      Areas: [],
      Devices: [],
      Floors: [
        {
          Areas: [
            {
              BuildingId: 1,
              Devices: [
                {
                  AreaID: 100,
                  BuildingID: 1,
                  Device: ataDeviceData,
                  DeviceID: 1001,
                  DeviceName: 'AC unit',
                  FloorID: 10,
                  Type: DeviceType.Ata,
                },
              ],
              FloorId: 10,
              ID: 100,
              Name: 'Living room',
            },
          ],
          BuildingId: 1,
          Devices: [],
          ID: 10,
          Name: 'Ground floor',
        },
      ],
    },
    TimeZone: 1,
  },
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

vi.mock(import('axios'), () =>
  mock<typeof import('axios')>({
    default: mock<AxiosStatic>({ create: vi.fn().mockReturnValue(mockAxiosInstance) }),
    HttpStatusCode: mock<typeof HttpStatusCode>({
      TooManyRequests: 429,
      Unauthorized: 401,
    }),
  }),
)

describe('API lifecycle', () => {
  let MELCloudAPI: typeof import('../../src/services/melcloud.ts').MELCloudAPI

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockAxiosInstance.get.mockResolvedValue({ data: buildingResponse })
    mockAxiosInstance.post.mockResolvedValue({ data: [] })
    const mod = await import('../../src/services/melcloud.ts')
    MELCloudAPI = mod.MELCloudAPI
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('creates API, syncs buildings, and populates the registry', async () => {
    const api = await MELCloudAPI.create({ autoSyncInterval: 0 })

    expect(api.registry.getDevices()).toHaveLength(1)
    expect(api.registry.getDevicesByBuildingId(1)).toHaveLength(1)
    expect(api.registry.getFloorsByBuildingId(1)).toHaveLength(1)
    expect(api.registry.getAreasByFloorId(10)).toHaveLength(1)
    expect(api.registry.getDevicesByAreaId(100)).toHaveLength(1)

    const device = api.registry.devices.getById(1001)

    expect(device).toBeDefined()
    expect(device!.name).toBe('AC unit')
    expect(device!.type).toBe(DeviceType.Ata)
  })

  it('FacadeManager works with registry populated by API', async () => {
    const api = await MELCloudAPI.create({ autoSyncInterval: 0 })
    const manager = new FacadeManager(api, api.registry)

    const building = api.registry.buildings.getById(1)!
    const facade = manager.get(building)

    expect(facade.name).toBe('Home')
    expect(facade.devices).toHaveLength(1)
    expect(facade.devices[0]!.name).toBe('AC unit')
  })

  it('authenticate → fetch → registry reflects updated data', async () => {
    mockAxiosInstance.get.mockResolvedValue({ data: [] })
    const api = await MELCloudAPI.create({ autoSyncInterval: 0 })

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
    expect(api.registry.buildings.getById(1)!.name).toBe('Home')
  })

  it('settingManager persists credentials across API operations', async () => {
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

    const api = await MELCloudAPI.create({
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
    const api = await MELCloudAPI.create({ autoSyncInterval: 0 })

    expect(api.registry.getDevices()).toHaveLength(1)

    // Next fetch returns empty buildings
    mockAxiosInstance.get.mockResolvedValue({ data: [] })
    await api.fetch()

    expect(api.registry.getDevices()).toHaveLength(0)
    expect(api.registry.getFloorsByBuildingId(1)).toHaveLength(0)
  })

  it('onSync callback is invoked after fetch', async () => {
    const onSync = vi.fn().mockImplementation(async () => {})
    await MELCloudAPI.create({ autoSyncInterval: 0, onSync })

    expect(onSync).toHaveBeenCalled()
  })
})
