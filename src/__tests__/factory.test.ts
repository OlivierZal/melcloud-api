import { describe, expect, it } from 'vitest'

import type { IAPIAdapter } from '../services/index.ts'
import type { ListDeviceAny } from '../types/index.ts'

import { DeviceType } from '../enums.ts'
import { createFacade } from '../facades/factory.ts'
import { type IModel, ModelRegistry } from '../models/index.ts'

const mockApi = {} as IAPIAdapter

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
} as const

const floorData = { BuildingId: 1, ID: 10, Name: 'Floor' } as const

const areaData = {
  BuildingId: 1,
  FloorId: 10,
  ID: 100,
  Name: 'Area',
} as const

const deviceListData = {
  AreaID: null,
  BuildingID: 1,
  Device: {} as ListDeviceAny['Device'],
  DeviceID: 1000,
  DeviceName: 'ATA',
  FloorID: null,
  Type: DeviceType.Ata,
} as const

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

  it('throws for unsupported model types', () => {
    const registry = new ModelRegistry()
    const unknown = { id: 1, name: 'unknown' } as IModel
    expect(() => createFacade(mockApi, registry, unknown)).toThrow(
      'Model not supported',
    )
  })
})
