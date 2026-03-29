import { describe, expect, it } from 'vitest'

import type { APIAdapter } from '../../src/services/index.ts'
import { createFacade } from '../../src/facades/index.ts'
import { ModelRegistry } from '../../src/models/index.ts'
import {
  areaData,
  ataDevice,
  atwDevice,
  atwDeviceData,
  buildingData,
  ervDevice,
  floorData,
} from '../fixtures.ts'
import { defined, mock } from '../helpers.ts'

const mockApi = mock<APIAdapter>()

const deviceListData = ataDevice({
  AreaID: null,
  DeviceName: 'ATA',
  FloorID: null,
})

describe(createFacade, () => {
  it('creates a BuildingFacade for BuildingModel instances', () => {
    const registry = new ModelRegistry()
    registry.syncBuildings([buildingData()])
    const instance = defined(registry.buildings.getById(1))
    const facade = createFacade(mockApi, registry, instance)

    expect(facade.id).toBe(1)
    expect(facade.name).toBe('Building')
  })

  it('creates a FloorFacade for FloorModel instances', () => {
    const registry = new ModelRegistry()
    registry.syncFloors([floorData()])
    const instance = defined(registry.floors.getById(10))
    const facade = createFacade(mockApi, registry, instance)

    expect(facade.id).toBe(10)
    expect(facade.name).toBe('Floor')
  })

  it('creates an AreaFacade for AreaModel instances', () => {
    const registry = new ModelRegistry()
    registry.syncAreas([areaData()])
    const instance = defined(registry.areas.getById(100))
    const facade = createFacade(mockApi, registry, instance)

    expect(facade.id).toBe(100)
    expect(facade.name).toBe('Area')
  })

  it('creates a device facade for DeviceModel instances', () => {
    const registry = new ModelRegistry()
    registry.syncDevices([deviceListData])
    const instance = defined(registry.devices.getById(1000))
    const facade = createFacade(mockApi, registry, instance)

    expect(facade.id).toBe(1000)
  })

  it('creates a DeviceAtwFacade for ATW devices without zone2', () => {
    const registry = new ModelRegistry()
    registry.syncDevices([
      atwDevice({ Device: atwDeviceData({ HasZone2: false }) }),
    ])
    const instance = defined(registry.devices.getById(1001))
    const facade = createFacade(mockApi, registry, instance)

    expect(facade.id).toBe(1001)
  })

  it('creates a DeviceAtwHasZone2Facade for ATW devices with zone2', () => {
    const registry = new ModelRegistry()
    registry.syncDevices([
      atwDevice({ Device: atwDeviceData({ HasZone2: true }) }),
    ])
    const instance = defined(registry.devices.getById(1001))
    const facade = createFacade(mockApi, registry, instance)

    expect(facade.id).toBe(1001)
  })

  it('creates a DeviceErvFacade for ERV devices', () => {
    const registry = new ModelRegistry()
    registry.syncDevices([ervDevice()])
    const instance = defined(registry.devices.getById(1002))
    const facade = createFacade(mockApi, registry, instance)

    expect(facade.id).toBe(1002)
  })

  it('throws when device not found in registry', () => {
    const registry = new ModelRegistry()
    registry.syncDevices([deviceListData])
    const instance = defined(registry.devices.getById(1000))
    registry.syncDevices([])

    expect(() => createFacade(mockApi, registry, instance)).toThrow(
      'Device not found in registry',
    )
  })

  // Unsupported model types are now a compile-time error via exhaustive modelKind switch
})
