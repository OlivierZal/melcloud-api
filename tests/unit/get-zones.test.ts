import { describe, expect, it } from 'vitest'

import { DeviceType } from '../../src/constants.ts'
import { ModelRegistry } from '../../src/models/index.ts'
import {
  areaData,
  ataDevice,
  ataDeviceData,
  atwDevice,
  atwDeviceData,
  buildingData,
  floorData,
} from '../fixtures.ts'

const buildings = [
  buildingData({
    HMDefined: false,
    ID: 1,
    Location: 0,
    Name: 'Bravo',
    TimeZone: 1,
  }),
  buildingData({
    FPDefined: false,
    HMDefined: false,
    ID: 2,
    Location: 0,
    Name: 'Alpha',
    TimeZone: 1,
  }),
]

const floors = [floorData({ BuildingId: 1, ID: 10, Name: 'Ground floor' })]

const areas = [
  areaData({ BuildingId: 1, FloorId: 10, ID: 100, Name: 'Salon' }),
  areaData({ BuildingId: 2, FloorId: null, ID: 200, Name: 'Studio' }),
]

const devices = [
  ataDevice({
    AreaID: 100,
    BuildingID: 1,
    Device: ataDeviceData(),
    DeviceID: 1001,
    DeviceName: 'AC unit',
    FloorID: 10,
  }),
  atwDevice({
    AreaID: null,
    BuildingID: 1,
    Device: atwDeviceData({ HasZone2: false }),
    DeviceID: 1002,
    DeviceName: 'Heat pump',
    FloorID: null,
  }),
  ataDevice({
    AreaID: 200,
    BuildingID: 2,
    Device: ataDeviceData(),
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

describe('getBuildings', () => {
  it('returns all buildings with their hierarchy', () => {
    const registry = new ModelRegistry()
    syncAll(registry)

    const result = registry.getBuildings()

    expect(result).toHaveLength(2)
    expect(result[0]!.name).toBe('Alpha')
    expect(result[1]!.name).toBe('Bravo')
  })

  it('sets correct model and level for buildings', () => {
    const registry = new ModelRegistry()
    syncAll(registry)

    const [alpha] = registry.getBuildings()

    expect(alpha!.model).toBe('buildings')
    expect(alpha!.level).toBe(0)
  })

  it('includes floors, areas, and devices in hierarchy', () => {
    const registry = new ModelRegistry()
    syncAll(registry)

    const bravo = registry.getBuildings().find(({ name }) => name === 'Bravo')!

    expect(bravo.floors).toHaveLength(1)
    expect(bravo.floors[0]!.name).toBe('Ground floor')
    expect(bravo.floors[0]!.areas).toHaveLength(1)
    expect(bravo.floors[0]!.areas[0]!.name).toBe('Salon')
    expect(bravo.floors[0]!.areas[0]!.devices).toHaveLength(1)
    expect(bravo.floors[0]!.areas[0]!.devices[0]!.name).toBe('AC unit')
  })

  it('puts building-level devices (no floor/area) directly on the building', () => {
    const registry = new ModelRegistry()
    syncAll(registry)

    const bravo = registry.getBuildings().find(({ name }) => name === 'Bravo')!

    expect(bravo.devices).toHaveLength(1)
    expect(bravo.devices[0]!.name).toBe('Heat pump')
  })

  it('filters by device type', () => {
    const registry = new ModelRegistry()
    syncAll(registry)

    const ataBuildings = registry.getBuildings({ type: DeviceType.Ata })
    const atwBuildings = registry.getBuildings({ type: DeviceType.Atw })

    expect(ataBuildings).toHaveLength(2)
    expect(atwBuildings).toHaveLength(1)
    expect(atwBuildings[0]!.name).toBe('Bravo')
  })

  it('excludes buildings with no matching devices', () => {
    const registry = new ModelRegistry()
    syncAll(registry)

    const result = registry.getBuildings({ type: DeviceType.Erv })

    expect(result).toHaveLength(0)
  })

  it('sets correct levels for nested items', () => {
    const registry = new ModelRegistry()
    syncAll(registry)

    const bravo = registry.getBuildings().find(({ name }) => name === 'Bravo')!
    const floor = bravo.floors[0]!
    const area = floor.areas[0]!
    const device = area.devices[0]!

    expect(floor.level).toBe(1)
    expect(area.level).toBe(2)
    expect(device.level).toBe(3)
  })

  it('assigns level 1 to building-level devices', () => {
    const registry = new ModelRegistry()
    syncAll(registry)

    const bravo = registry.getBuildings().find(({ name }) => name === 'Bravo')!

    expect(bravo.devices[0]!.level).toBe(1)
  })
})

describe('getZones', () => {
  it('returns a flat, sorted list of all zones', () => {
    const registry = new ModelRegistry()
    syncAll(registry)

    const zones = registry.getZones()
    const names = zones.map(({ name }) => name)

    expect(names).toStrictEqual([
      'AC unit',
      'Alpha',
      'Bravo',
      'Ground floor',
      'Heat pump',
      'Salon',
      'Studio',
      'Studio AC',
    ])
  })

  it('filters zones by device type', () => {
    const registry = new ModelRegistry()
    syncAll(registry)

    const atwZones = registry.getZones({ type: DeviceType.Atw })

    expect(atwZones.map(({ name }) => name)).toStrictEqual([
      'Bravo',
      'Heat pump',
    ])
  })

  it('includes model type for each zone', () => {
    const registry = new ModelRegistry()
    syncAll(registry)

    const zones = registry.getZones()
    const models = zones.map(({ model, name }) => ({ model, name }))

    expect(models).toContainEqual({ model: 'buildings', name: 'Alpha' })
    expect(models).toContainEqual({ model: 'floors', name: 'Ground floor' })
    expect(models).toContainEqual({ model: 'areas', name: 'Salon' })
    expect(models).toContainEqual({ model: 'devices', name: 'AC unit' })
  })

  it('returns empty list when no devices match', () => {
    const registry = new ModelRegistry()
    syncAll(registry)

    expect(registry.getZones({ type: DeviceType.Erv })).toHaveLength(0)
  })
})
