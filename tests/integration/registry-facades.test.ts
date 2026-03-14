import { describe, expect, it, vi } from 'vitest'

import type { APIAdapter } from '../../src/services/index.ts'
import type {
  AreaDataAny,
  BuildingData,
  FloorData,
  ListDeviceAny,
  ListDeviceDataAta,
  ListDeviceDataAtw,
  ListDeviceDataErv,
} from '../../src/types/index.ts'

import { DeviceType } from '../../src/enums.ts'
import { FacadeManager } from '../../src/facades/manager.ts'
import { ModelRegistry } from '../../src/models/index.ts'

const ataDeviceData: ListDeviceDataAta = {
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
} as ListDeviceDataAta

const atwDeviceData: ListDeviceDataAtw = {
  EffectiveFlags: 0,
  HasZone2: true,
  IdleZone1: false,
  IdleZone2: false,
  OperationMode: 0,
  OutdoorTemperature: 10,
  Power: true,
  ProhibitCoolingZone1: false,
  ProhibitCoolingZone2: false,
  ProhibitHeatingZone1: false,
  ProhibitHeatingZone2: false,
  RoomTemperatureZone1: 21,
  RoomTemperatureZone2: 19,
  SetCoolFlowTemperatureZone1: 25,
  SetCoolFlowTemperatureZone2: 25,
  SetHeatFlowTemperatureZone1: 40,
  SetHeatFlowTemperatureZone2: 35,
  SetTankWaterTemperature: 50,
  SetTemperatureZone1: 22,
  SetTemperatureZone2: 20,
  TankWaterTemperature: 48,
} as ListDeviceDataAtw

const ervDeviceData: ListDeviceDataErv = {
  EffectiveFlags: 0,
  HasAutomaticFanSpeed: false,
  HasCO2Sensor: true,
  HasPM25Sensor: false,
  NumberOfFanSpeeds: 4,
  Offline: false,
  OperationMode: 0,
  OutdoorTemperature: 15,
  PM25Level: 0,
  Power: true,
  RoomCO2Level: 500,
  RoomTemperature: 22,
  SetFanSpeed: 2,
  SetTemperature: 24,
  VentilationMode: 0,
  WifiSignalStrength: -50,
} as unknown as ListDeviceDataErv

const buildings: BuildingData[] = [
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
    Name: 'Main house',
    TimeZone: 1,
  },
  {
    FPDefined: false,
    FPEnabled: false,
    FPMaxTemperature: 16,
    FPMinTemperature: 4,
    HMDefined: false,
    HMEnabled: false,
    HMEndDate: null,
    HMStartDate: null,
    ID: 2,
    Location: 0,
    Name: 'Guest house',
    TimeZone: 1,
  },
]

const floors: FloorData[] = [
  { BuildingId: 1, ID: 10, Name: 'Ground floor' },
  { BuildingId: 1, ID: 11, Name: 'First floor' },
]

const areas: AreaDataAny[] = [
  { BuildingId: 1, FloorId: 10, ID: 100, Name: 'Living room' },
  { BuildingId: 1, FloorId: 10, ID: 101, Name: 'Kitchen' },
  { BuildingId: 1, FloorId: 11, ID: 102, Name: 'Bedroom' },
  { BuildingId: 2, FloorId: null, ID: 200, Name: 'Studio' },
]

const devices: ListDeviceAny[] = [
  {
    AreaID: 100,
    BuildingID: 1,
    Device: ataDeviceData,
    DeviceID: 1001,
    DeviceName: 'Living room AC',
    FloorID: 10,
    Type: DeviceType.Ata,
  },
  {
    AreaID: 101,
    BuildingID: 1,
    Device: atwDeviceData,
    DeviceID: 1002,
    DeviceName: 'Kitchen heat pump',
    FloorID: 10,
    Type: DeviceType.Atw,
  },
  {
    AreaID: 102,
    BuildingID: 1,
    Device: ervDeviceData,
    DeviceID: 1003,
    DeviceName: 'Bedroom ERV',
    FloorID: 11,
    Type: DeviceType.Erv,
  },
  {
    AreaID: 200,
    BuildingID: 2,
    Device: { ...ataDeviceData, Power: false } as ListDeviceDataAta,
    DeviceID: 2001,
    DeviceName: 'Studio AC',
    FloorID: null,
    Type: DeviceType.Ata,
  },
]

const createMockApi = (): APIAdapter =>
  ({
    energy: vi.fn(),
    errorLog: vi.fn(),
    errors: vi.fn(),
    fetch: vi.fn().mockResolvedValue([]),
    frostProtection: vi
      .fn()
      .mockResolvedValue({ data: { FPEnabled: false } }),
    group: vi.fn(),
    holidayMode: vi.fn().mockResolvedValue({ data: { HMEnabled: false } }),
    hourlyTemperatures: vi.fn(),
    internalTemperatures: vi.fn(),
    onSync: vi.fn().mockResolvedValue(),
    operationModes: vi.fn(),
    setFrostProtection: vi
      .fn()
      .mockResolvedValue({ data: { Success: true } }),
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
  }) as unknown as APIAdapter

const syncAll = (registry: ModelRegistry): void => {
  registry.syncBuildings(buildings)
  registry.syncFloors(floors)
  registry.syncAreas(areas)
  registry.syncDevices(devices)
}

describe('registry + facade manager integration', () => {
  it('syncs a full building hierarchy and resolves cross-references', () => {
    const registry = new ModelRegistry()
    syncAll(registry)

    expect(registry.getDevicesByBuildingId(1)).toHaveLength(3)
    expect(registry.getDevicesByBuildingId(2)).toHaveLength(1)
    expect(registry.getFloorsByBuildingId(1)).toHaveLength(2)
    expect(registry.getFloorsByBuildingId(2)).toHaveLength(0)
    expect(registry.getAreasByFloorId(10)).toHaveLength(2)
    expect(registry.getAreasByFloorId(11)).toHaveLength(1)
    expect(registry.getAreasByBuildingId(2)).toHaveLength(1)
    expect(registry.getDevicesByFloorId(10)).toHaveLength(2)
    expect(registry.getDevicesByFloorId(11)).toHaveLength(1)
    expect(registry.getDevicesByAreaId(100)).toHaveLength(1)
    expect(registry.getDevicesByAreaId(200)).toHaveLength(1)
  })

  it('filters devices by type across the entire registry', () => {
    const registry = new ModelRegistry()
    syncAll(registry)

    const ataDevices = registry.getDevicesByType(DeviceType.Ata)
    const atwDevices = registry.getDevicesByType(DeviceType.Atw)
    const ervDevices = registry.getDevicesByType(DeviceType.Erv)

    expect(ataDevices).toHaveLength(2)
    expect(atwDevices).toHaveLength(1)
    expect(ervDevices).toHaveLength(1)
    expect(ataDevices.every((d) => d.type === DeviceType.Ata)).toBe(true)
  })

  it('creates facades for every model type via FacadeManager', () => {
    const registry = new ModelRegistry()
    syncAll(registry)
    const api = createMockApi()
    const manager = new FacadeManager(api, registry)

    const building = registry.buildings.getById(1)!
    const floor = registry.floors.getById(10)!
    const area = registry.areas.getById(100)!
    const device = registry.devices.getById(1001)!

    const buildingFacade = manager.get(building)
    const floorFacade = manager.get(floor)
    const areaFacade = manager.get(area)
    const deviceFacade = manager.get(device)

    expect(buildingFacade).toBeDefined()
    expect(floorFacade).toBeDefined()
    expect(areaFacade).toBeDefined()
    expect(deviceFacade).toBeDefined()
  })

  it('caches facades — same model instance returns same facade', () => {
    const registry = new ModelRegistry()
    syncAll(registry)
    const api = createMockApi()
    const manager = new FacadeManager(api, registry)

    const building = registry.buildings.getById(1)!

    expect(manager.get(building)).toBe(manager.get(building))
  })

  it('building facade lists all devices belonging to the building', () => {
    const registry = new ModelRegistry()
    syncAll(registry)
    const api = createMockApi()
    const manager = new FacadeManager(api, registry)

    const building1 = registry.buildings.getById(1)!
    const building2 = registry.buildings.getById(2)!

    const facade1 = manager.get(building1)
    const facade2 = manager.get(building2)

    expect(facade1.devices).toHaveLength(3)
    expect(facade2.devices).toHaveLength(1)
    expect(facade1.name).toBe('Main house')
    expect(facade2.name).toBe('Guest house')
  })

  it('building facade delegates setPower to API with correct device IDs', async () => {
    const registry = new ModelRegistry()
    syncAll(registry)
    const api = createMockApi()
    const manager = new FacadeManager(api, registry)

    const building = registry.buildings.getById(1)!
    const facade = manager.get(building)
    await facade.setPower(false)

    expect(api.setPower).toHaveBeenCalledWith({
      postData: {
        DeviceIds: [1001, 1002, 1003],
        Power: false,
      },
    })
  })

  it('re-sync updates models and facades reflect new data', () => {
    const registry = new ModelRegistry()
    syncAll(registry)
    const api = createMockApi()
    const manager = new FacadeManager(api, registry)

    const building = registry.buildings.getById(2)!
    const facade = manager.get(building)

    expect(facade.devices).toHaveLength(1)

    // Add a new device to building 2
    registry.syncDevices([
      ...devices,
      {
        AreaID: 200,
        BuildingID: 2,
        Device: ataDeviceData,
        DeviceID: 2002,
        DeviceName: 'Studio AC 2',
        FloorID: null,
        Type: DeviceType.Ata,
      },
    ])

    // Facade reflects updated registry
    expect(facade.devices).toHaveLength(2)
  })

  it('floor facade resolves devices on that floor only', () => {
    const registry = new ModelRegistry()
    syncAll(registry)
    const api = createMockApi()
    const manager = new FacadeManager(api, registry)

    const groundFloor = registry.floors.getById(10)!
    const firstFloor = registry.floors.getById(11)!

    const groundFacade = manager.get(groundFloor)
    const firstFacade = manager.get(firstFloor)

    expect(groundFacade.devices).toHaveLength(2)
    expect(firstFacade.devices).toHaveLength(1)
    expect(firstFacade.devices[0]!.name).toBe('Bedroom ERV')
  })

  it('area facade resolves devices in that area only', () => {
    const registry = new ModelRegistry()
    syncAll(registry)
    const api = createMockApi()
    const manager = new FacadeManager(api, registry)

    const livingRoom = registry.areas.getById(100)!
    const facade = manager.get(livingRoom)

    expect(facade.devices).toHaveLength(1)
    expect(facade.devices[0]!.name).toBe('Living room AC')
  })

  it('handles buildings with no floors or areas', () => {
    const registry = new ModelRegistry()
    registry.syncBuildings([buildings[1]!])
    registry.syncFloors([])
    registry.syncAreas([{ BuildingId: 2, FloorId: null, ID: 200, Name: 'Studio' }])
    registry.syncDevices([devices[3]!])

    const api = createMockApi()
    const manager = new FacadeManager(api, registry)

    const building = registry.buildings.getById(2)!
    const facade = manager.get(building)

    expect(facade.devices).toHaveLength(1)
    expect(registry.getFloorsByBuildingId(2)).toHaveLength(0)
    expect(registry.getAreasByBuildingId(2)).toHaveLength(1)
  })
})
