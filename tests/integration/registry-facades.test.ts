import { describe, expect, it } from 'vitest'

import { DeviceType } from '../../src/constants.ts'
import { ClassicFacadeManager } from '../../src/facades/classic-manager.ts'
import { ClassicRegistry } from '../../src/models/index.ts'
import { toAreaId, toBuildingId, toDeviceId, toFloorId } from '../../src/types/index.ts'
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
import { createMockApi, createPopulatedRegistry, defined } from '../helpers.ts'

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
    ID: toBuildingId(2),
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
  areaData({
    BuildingId: toBuildingId(2),
    FloorId: null,
    ID: 200,
    Name: 'Studio',
  }),
]

const devices = [
  ataDevice({
    Device: ataData,
    DeviceID: toDeviceId(1001),
    DeviceName: 'Living room AC',
  }),
  atwDevice({
    AreaID: toAreaId(101),
    Device: atwData,
    DeviceID: toDeviceId(1002),
    DeviceName: 'Kitchen heat pump',
  }),
  ervDevice({
    AreaID: toAreaId(102),
    BuildingID: toBuildingId(1),
    Device: ervData,
    DeviceID: toDeviceId(1003),
    DeviceName: 'Bedroom ERV',
    FloorID: toFloorId(11),
  }),
  ataDevice({
    AreaID: toAreaId(200),
    BuildingID: toBuildingId(2),
    Device: ataDeviceData({ ...ataData, Power: false }),
    DeviceID: toDeviceId(2001),
    DeviceName: 'Studio AC',
    FloorID: null,
  }),
]

const createContext = (): {
  api: ReturnType<typeof createMockApi>
  manager: ClassicFacadeManager
  registry: ClassicRegistry
} => {
  const registry = createPopulatedRegistry({
    areas,
    buildings,
    devices,
    floors,
  })
  const api = createMockApi()
  const manager = new ClassicFacadeManager(api, registry)
  return { api, manager, registry }
}

describe('registry + facade manager integration', () => {
  it('syncs a full building hierarchy and resolves cross-references', () => {
    const { registry } = createContext()

    expect(registry.getDevicesByBuildingId(toBuildingId(1))).toHaveLength(3)
    expect(registry.getDevicesByBuildingId(toBuildingId(2))).toHaveLength(1)
    expect(registry.getFloorsByBuildingId(toBuildingId(1))).toHaveLength(2)
    expect(registry.getFloorsByBuildingId(toBuildingId(2))).toHaveLength(0)
    expect(registry.getAreasByFloorId(toFloorId(10))).toHaveLength(2)
    expect(registry.getAreasByFloorId(toFloorId(11))).toHaveLength(1)
    expect(registry.getAreasByBuildingId(toBuildingId(2))).toHaveLength(1)
    expect(registry.getDevicesByFloorId(toFloorId(10))).toHaveLength(2)
    expect(registry.getDevicesByFloorId(toFloorId(11))).toHaveLength(1)
    expect(registry.getDevicesByAreaId(toAreaId(100))).toHaveLength(1)
    expect(registry.getDevicesByAreaId(toAreaId(200))).toHaveLength(1)
  })

  /*
   * Inline snapshot capturing the zone tree shape returned by
   * getBuildings(). Guards against regressions in the hierarchy
   * flattening logic without being brittle on device-data fields
   * that may change with upstream API bumps.
   */
  it('zone tree shape matches the expected hierarchy', () => {
    const { registry } = createContext()

    const tree = registry
      .getBuildings()
      .map(
        ({
          areas: buildingAreas,
          floors: buildingFloors,
          name: buildingName,
        }) => ({
          areas: buildingAreas.map(({ devices: areaDevs, name: areaName }) => ({
            devices: areaDevs.map(({ name: deviceName }) => deviceName),
            name: areaName,
          })),
          floors: buildingFloors.map(
            ({ areas: floorAreas, devices: floorDevs, name: floorName }) => ({
              areas: floorAreas.map(
                ({ devices: areaDevs, name: areaName }) => ({
                  devices: areaDevs.map(({ name: deviceName }) => deviceName),
                  name: areaName,
                }),
              ),
              devices: floorDevs.map(({ name: deviceName }) => deviceName),
              name: floorName,
            }),
          ),
          name: buildingName,
        }),
      )

    expect(tree).toMatchInlineSnapshot(`
      [
        {
          "areas": [
            {
              "devices": [
                "Studio AC",
              ],
              "name": "Studio",
            },
          ],
          "floors": [],
          "name": "Guest house",
        },
        {
          "areas": [],
          "floors": [
            {
              "areas": [
                {
                  "devices": [
                    "Bedroom ERV",
                  ],
                  "name": "Bedroom",
                },
              ],
              "devices": [],
              "name": "First floor",
            },
            {
              "areas": [
                {
                  "devices": [
                    "Kitchen heat pump",
                  ],
                  "name": "Kitchen",
                },
                {
                  "devices": [
                    "Living room AC",
                  ],
                  "name": "Living room",
                },
              ],
              "devices": [],
              "name": "Ground floor",
            },
          ],
          "name": "Main house",
        },
      ]
    `)
  })

  it('filters devices by type across the entire registry', () => {
    const { registry } = createContext()

    const ataDevices = registry.getDevicesByType(DeviceType.Ata)
    const atwDevices = registry.getDevicesByType(DeviceType.Atw)
    const ervDevices = registry.getDevicesByType(DeviceType.Erv)

    expect(ataDevices).toHaveLength(2)
    expect(atwDevices).toHaveLength(1)
    expect(ervDevices).toHaveLength(1)
  })

  it('creates facades for every model type via ClassicFacadeManager', () => {
    const { manager, registry } = createContext()

    expect(manager.get(defined(registry.buildings.getById(1)))).toBeDefined()
    expect(manager.get(defined(registry.floors.getById(10)))).toBeDefined()
    expect(manager.get(defined(registry.areas.getById(100)))).toBeDefined()
    expect(manager.get(defined(registry.devices.getById(1001)))).toBeDefined()
  })

  it('caches facades — same model instance returns same facade', () => {
    const { manager, registry } = createContext()
    const building = defined(registry.buildings.getById(1))

    expect(manager.get(building)).toBe(manager.get(building))
  })

  it('building facade lists all devices belonging to the building', () => {
    const { manager, registry } = createContext()

    const facade1 = manager.get(defined(registry.buildings.getById(1)))
    const facade2 = manager.get(defined(registry.buildings.getById(2)))

    expect(facade1.devices).toHaveLength(3)
    expect(facade2.devices).toHaveLength(1)
    expect(facade1.name).toBe('Main house')
    expect(facade2.name).toBe('Guest house')
  })

  it('building facade delegates setPower to ClassicAPI with correct device IDs', async () => {
    const { api, manager, registry } = createContext()

    const facade = manager.get(defined(registry.buildings.getById(1)))
    await facade.setPower(false)

    expect(api.setPower).toHaveBeenCalledWith({
      postData: {
        DeviceIds: [1001, 1002, 1003],
        Power: false,
      },
    })
  })

  it('re-sync updates models and facades reflect new data', () => {
    const { manager, registry } = createContext()

    const facade = manager.get(defined(registry.buildings.getById(2)))

    expect(facade.devices).toHaveLength(1)

    registry.syncDevices([
      ...devices,
      ataDevice({
        AreaID: toAreaId(200),
        BuildingID: toBuildingId(2),
        Device: ataData,
        DeviceID: toDeviceId(2002),
        DeviceName: 'Studio AC 2',
        FloorID: null,
      }),
    ])

    expect(facade.devices).toHaveLength(2)
  })

  it('floor facade resolves devices on that floor only', () => {
    const { manager, registry } = createContext()

    const groundFacade = manager.get(defined(registry.floors.getById(10)))
    const firstFacade = manager.get(defined(registry.floors.getById(11)))

    expect(groundFacade.devices).toHaveLength(2)
    expect(firstFacade.devices).toHaveLength(1)
    expect(defined(firstFacade.devices[0]).name).toBe('Bedroom ERV')
  })

  it('area facade resolves devices in that area only', () => {
    const { manager, registry } = createContext()

    const facade = manager.get(defined(registry.areas.getById(100)))

    expect(facade.devices).toHaveLength(1)
    expect(defined(facade.devices[0]).name).toBe('Living room AC')
  })

  it('handles buildings with no floors or areas', () => {
    const registry = new ClassicRegistry()
    registry.syncBuildings([defined(buildings[1])])
    registry.syncFloors([])
    registry.syncAreas([
      areaData({
        BuildingId: toBuildingId(2),
        FloorId: null,
        ID: 200,
        Name: 'Studio',
      }),
    ])
    registry.syncDevices([defined(devices[3])])

    const manager = new ClassicFacadeManager(createMockApi(), registry)
    const facade = manager.get(defined(registry.buildings.getById(2)))

    expect(facade.devices).toHaveLength(1)
    expect(registry.getFloorsByBuildingId(toBuildingId(2))).toHaveLength(0)
    expect(registry.getAreasByBuildingId(toBuildingId(2))).toHaveLength(1)
  })
})
