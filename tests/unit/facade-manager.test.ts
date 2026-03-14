import { describe, expect, it } from 'vitest'

import type {
  AreaDataAny,
  BuildingData,
  FloorData,
  ListDeviceAny,
} from '../../src/types/index.ts'

import { DeviceType } from '../../src/enums.ts'
import { FacadeManager } from '../../src/facades/manager.ts'
import { ModelRegistry } from '../../src/models/index.ts'

const buildingData: BuildingData = {
  FPDefined: true,
  FPEnabled: false,
  FPMaxTemperature: 16,
  FPMinTemperature: 4,
  HMDefined: false,
  HMEnabled: false,
  HMEndDate: null,
  HMStartDate: null,
  ID: 1,
  Location: 10,
  Name: 'Building',
  TimeZone: 0,
}

const floorData: FloorData = { BuildingId: 1, ID: 10, Name: 'Floor' }

const areaData: AreaDataAny = {
  BuildingId: 1,
  FloorId: 10,
  ID: 100,
  Name: 'Area',
}

const deviceData = {
  AreaID: 100,
  BuildingID: 1,
  Device: {
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
    Offline: false,
    OperationMode: 1,
    OutdoorTemperature: 20,
    Power: true,
    RoomTemperature: 22,
    SetTemperature: 24,
    VaneHorizontalDirection: 0,
    VaneVerticalDirection: 0,
    WifiSignalStrength: -50,
  } as ListDeviceAny['Device'],
  DeviceID: 1000,
  DeviceName: 'Device ATA',
  FloorID: 10,
  Type: DeviceType.Ata,
} as ListDeviceAny

const mockApi = {} as Parameters<typeof FacadeManager.prototype.get>[0] extends
  infer _T
  ? ConstructorParameters<typeof FacadeManager>[0]
  : never

const createPopulatedRegistry = (): ModelRegistry => {
  const registry = new ModelRegistry()
  registry.syncBuildings([buildingData])
  registry.syncFloors([floorData])
  registry.syncAreas([areaData])
  registry.syncDevices([deviceData])
  return registry
}

describe('facadeManager', () => {
  it('returns null when no instance is provided', () => {
    const registry = new ModelRegistry()
    const manager = new FacadeManager({} as typeof mockApi, registry)

    expect(manager.get()).toBeNull()
  })

  it('returns a facade for a building instance', () => {
    const registry = createPopulatedRegistry()
    const manager = new FacadeManager({} as typeof mockApi, registry)
    const building = registry.buildings.getById(1)!
    const facade = manager.get(building)

    expect(facade).not.toBeNull()
    expect(facade!.id).toBe(1)
    expect(facade!.name).toBe('Building')
  })

  it('returns a facade for a floor instance', () => {
    const registry = createPopulatedRegistry()
    const manager = new FacadeManager({} as typeof mockApi, registry)
    const floor = registry.floors.getById(10)!
    const facade = manager.get(floor)

    expect(facade).not.toBeNull()
    expect(facade!.id).toBe(10)
  })

  it('returns a facade for an area instance', () => {
    const registry = createPopulatedRegistry()
    const manager = new FacadeManager({} as typeof mockApi, registry)
    const area = registry.areas.getById(100)!
    const facade = manager.get(area)

    expect(facade).not.toBeNull()
    expect(facade!.id).toBe(100)
  })

  it('returns a facade for a device instance', () => {
    const registry = createPopulatedRegistry()
    const manager = new FacadeManager({} as typeof mockApi, registry)
    const device = registry.devices.getById(1000)!
    const facade = manager.get(device)

    expect(facade).not.toBeNull()
    expect(facade!.id).toBe(1000)
  })

  it('caches facades for the same instance', () => {
    const registry = createPopulatedRegistry()
    const manager = new FacadeManager({} as typeof mockApi, registry)
    const building = registry.buildings.getById(1)!
    const facade1 = manager.get(building)
    const facade2 = manager.get(building)

    expect(facade1).toBe(facade2)
  })

  it('returns buildings via getBuildings', () => {
    const registry = createPopulatedRegistry()
    const manager = new FacadeManager({} as typeof mockApi, registry)
    const buildings = manager.getBuildings()

    expect(buildings).toHaveLength(1)
    expect(buildings[0]!.name).toBe('Building')
  })

  it('filters buildings by device type via getBuildings', () => {
    const registry = createPopulatedRegistry()
    const manager = new FacadeManager({} as typeof mockApi, registry)

    expect(manager.getBuildings({ type: DeviceType.Ata })).toHaveLength(1)
    expect(manager.getBuildings({ type: DeviceType.Atw })).toHaveLength(0)
  })

  it('returns zones via getZones', () => {
    const registry = createPopulatedRegistry()
    const manager = new FacadeManager({} as typeof mockApi, registry)
    const zones = manager.getZones()

    expect(zones.length).toBeGreaterThan(0)
  })

  it('filters zones by device type via getZones', () => {
    const registry = createPopulatedRegistry()
    const manager = new FacadeManager({} as typeof mockApi, registry)

    expect(manager.getZones({ type: DeviceType.Ata }).length).toBeGreaterThan(0)
    expect(manager.getZones({ type: DeviceType.Atw })).toHaveLength(0)
  })
})
