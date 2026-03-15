import { describe, expect, it } from 'vitest'

import { DeviceType } from '../../src/constants.ts'
import { FacadeManager } from '../../src/facades/manager.ts'
import { ModelRegistry } from '../../src/models/index.ts'
import {
  areaData,
  ataDevice,
  ataDeviceData,
  atwDevice,
  atwDeviceData,
  buildingData,
  ervDevice,
  ervDeviceData,
  floorData,
} from '../fixtures.ts'
import { createMockApi } from '../helpers.ts'

const ataData = ataDeviceData({
  NumberOfFanSpeeds: 5,
  SetTemperature: 23,
})

const atwData = atwDeviceData({
  HasZone2: true,
  OperationMode: 0,
  OutdoorTemperature: 10,
  SetCoolFlowTemperatureZone1: 25,
  SetCoolFlowTemperatureZone2: 25,
  SetHeatFlowTemperatureZone2: 35,
})

const ervData = ervDeviceData({
  HasAutomaticFanSpeed: false,
  HasCO2Sensor: true,
  NumberOfFanSpeeds: 4,
  OutdoorTemperature: 15,
  RoomCO2Level: 500,
  RoomTemperature: 22,
  SetFanSpeed: 2,
})

const buildings = [
  buildingData({
    HMDefined: true,
    Location: 0,
    Name: 'Main house',
    TimeZone: 1,
  }),
  buildingData({
    FPDefined: false,
    HMDefined: false,
    ID: 2,
    Location: 0,
    Name: 'Guest house',
    TimeZone: 1,
  }),
]

const floors = [
  floorData({ Name: 'Ground floor' }),
  floorData({ ID: 11, Name: 'First floor' }),
]

const areas = [
  areaData({ Name: 'Living room' }),
  areaData({ ID: 101, Name: 'Kitchen' }),
  areaData({ FloorId: 11, ID: 102, Name: 'Bedroom' }),
  areaData({ BuildingId: 2, FloorId: null, ID: 200, Name: 'Studio' }),
]

const devices = [
  ataDevice({
    Device: ataData,
    DeviceID: 1001,
    DeviceName: 'Living room AC',
  }),
  atwDevice({
    AreaID: 101,
    Device: atwData,
    DeviceID: 1002,
    DeviceName: 'Kitchen heat pump',
  }),
  ervDevice({
    AreaID: 102,
    BuildingID: 1,
    Device: ervData,
    DeviceID: 1003,
    DeviceName: 'Bedroom ERV',
    FloorID: 11,
  }),
  ataDevice({
    AreaID: 200,
    BuildingID: 2,
    Device: ataDeviceData({ ...ataData, Power: false }),
    DeviceID: 2001,
    DeviceName: 'Studio AC',
    FloorID: null,
  }),
]

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
      ataDevice({
        AreaID: 200,
        BuildingID: 2,
        Device: ataData,
        DeviceID: 2002,
        DeviceName: 'Studio AC 2',
        FloorID: null,
      }),
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
    registry.syncAreas([
      areaData({ BuildingId: 2, FloorId: null, ID: 200, Name: 'Studio' }),
    ])
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
