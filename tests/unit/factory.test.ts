import { describe, expect, it } from 'vitest'

import type { APIAdapter } from '../../src/services/index.ts'
import type {
  ListDevice,
  ListDeviceDataAta,
  ListDeviceDataAtw,
  ListDeviceDataErv,
} from '../../src/types/index.ts'

import { DeviceType } from '../../src/constants.ts'
import { createFacade } from '../../src/facades/factory.ts'
import { type Model, ModelRegistry } from '../../src/models/index.ts'
import { mock } from '../helpers.ts'

const mockApi = mock<APIAdapter>()

const buildingData = {
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
} as const

const floorData = { BuildingId: 1, ID: 10, Name: 'Floor' } as const

const areaData = {
  BuildingId: 1,
  FloorId: 10,
  ID: 100,
  Name: 'Area',
} as const

const deviceListData = mock<ListDevice<typeof DeviceType.Ata>>({
  AreaID: null,
  BuildingID: 1,
  Device: mock<ListDeviceDataAta>(),
  DeviceID: 1000,
  DeviceName: 'ATA',
  FloorID: null,
  Type: DeviceType.Ata,
})

describe('createFacade', () => {
  it('creates a BuildingFacade for BuildingModel instances', () => {
    const registry = new ModelRegistry()
    registry.syncBuildings([buildingData])
    const instance = registry.buildings.getById(1)!
    const facade = createFacade(mockApi, registry, instance)

    expect(facade.id).toBe(1)
    expect(facade.name).toBe('Building')
  })

  it('creates a FloorFacade for FloorModel instances', () => {
    const registry = new ModelRegistry()
    registry.syncFloors([floorData])
    const instance = registry.floors.getById(10)!
    const facade = createFacade(mockApi, registry, instance)

    expect(facade.id).toBe(10)
    expect(facade.name).toBe('Floor')
  })

  it('creates an AreaFacade for AreaModel instances', () => {
    const registry = new ModelRegistry()
    registry.syncAreas([areaData])
    const instance = registry.areas.getById(100)!
    const facade = createFacade(mockApi, registry, instance)

    expect(facade.id).toBe(100)
    expect(facade.name).toBe('Area')
  })

  it('creates a device facade for DeviceModel instances', () => {
    const registry = new ModelRegistry()
    registry.syncDevices([deviceListData])
    const instance = registry.devices.getById(1000)!
    const facade = createFacade(mockApi, registry, instance)

    expect(facade.id).toBe(1000)
  })

  it('creates a DeviceAtwFacade for ATW devices without zone2', () => {
    const registry = new ModelRegistry()
    registry.syncDevices([
      mock<ListDevice<typeof DeviceType.Atw>>({
        AreaID: null,
        BuildingID: 1,
        Device: mock<ListDeviceDataAtw>({ HasZone2: false }),
        DeviceID: 1000,
        DeviceName: 'ATW',
        FloorID: null,
        Type: DeviceType.Atw,
      }),
    ])
    const instance = registry.devices.getById(1000)!
    const facade = createFacade(mockApi, registry, instance)

    expect(facade.id).toBe(1000)
  })

  it('creates a DeviceAtwHasZone2Facade for ATW devices with zone2', () => {
    const registry = new ModelRegistry()
    registry.syncDevices([
      mock<ListDevice<typeof DeviceType.Atw>>({
        AreaID: null,
        BuildingID: 1,
        Device: mock<ListDeviceDataAtw>({ HasZone2: true }),
        DeviceID: 1000,
        DeviceName: 'ATW',
        FloorID: null,
        Type: DeviceType.Atw,
      }),
    ])
    const instance = registry.devices.getById(1000)!
    const facade = createFacade(mockApi, registry, instance)

    expect(facade.id).toBe(1000)
  })

  it('creates a DeviceErvFacade for ERV devices', () => {
    const registry = new ModelRegistry()
    registry.syncDevices([
      mock<ListDevice<typeof DeviceType.Erv>>({
        AreaID: null,
        BuildingID: 1,
        Device: mock<ListDeviceDataErv>(),
        DeviceID: 1000,
        DeviceName: 'ERV',
        FloorID: null,
        Type: DeviceType.Erv,
      }),
    ])
    const instance = registry.devices.getById(1000)!
    const facade = createFacade(mockApi, registry, instance)

    expect(facade.id).toBe(1000)
  })

  it('throws for unsupported model types', () => {
    const registry = new ModelRegistry()
    const unknown = mock<Model>({ id: 1, name: 'unknown' })

    expect(() => createFacade(mockApi, registry, unknown)).toThrow(
      'Model not supported',
    )
  })
})
