import { describe, expect, it } from 'vitest'

import type { ClassicRegistry } from '../../src/entities/index.ts'
import { ClassicDeviceType } from '../../src/constants.ts'
import {
  toClassicAreaId,
  toClassicBuildingId,
  toClassicDeviceId,
  toClassicFloorId,
} from '../../src/types/index.ts'
import {
  areaData,
  ataDevice,
  ataDeviceData,
  atwDevice,
  atwDeviceData,
  buildingData,
  floorData,
} from '../fixtures.ts'
import { createPopulatedRegistry, defined } from '../helpers.ts'

const buildings = [
  buildingData({
    HMDefined: false,
    ID: toClassicBuildingId(1),
    Location: 0,
    Name: 'Bravo',
    TimeZone: 1,
  }),
  buildingData({
    FPDefined: false,
    HMDefined: false,
    ID: toClassicBuildingId(2),
    Location: 0,
    Name: 'Alpha',
    TimeZone: 1,
  }),
]

const floors = [
  floorData({
    BuildingId: toClassicBuildingId(1),
    ID: 10,
    Name: 'Ground floor',
  }),
]

const areas = [
  areaData({
    BuildingId: toClassicBuildingId(1),
    FloorId: 10,
    ID: 100,
    Name: 'Salon',
  }),
  areaData({
    BuildingId: toClassicBuildingId(2),
    FloorId: null,
    ID: 200,
    Name: 'Studio',
  }),
]

const devices = [
  ataDevice({
    AreaID: toClassicAreaId(100),
    BuildingID: toClassicBuildingId(1),
    ClassicDevice: ataDeviceData(),
    DeviceID: toClassicDeviceId(1001),
    DeviceName: 'AC unit',
    FloorID: toClassicFloorId(10),
  }),
  atwDevice({
    AreaID: null,
    BuildingID: toClassicBuildingId(1),
    ClassicDevice: atwDeviceData({ HasZone2: false }),
    DeviceID: toClassicDeviceId(1002),
    DeviceName: 'Heat pump',
    FloorID: null,
  }),
  ataDevice({
    AreaID: toClassicAreaId(200),
    BuildingID: toClassicBuildingId(2),
    ClassicDevice: ataDeviceData(),
    DeviceID: toClassicDeviceId(2001),
    DeviceName: 'Studio AC',
    FloorID: null,
  }),
]

const createSyncedRegistry = (): ClassicRegistry =>
  createPopulatedRegistry({ areas, buildings, devices, floors })

describe('building retrieval', () => {
  it('returns all buildings with their hierarchy', () => {
    const result = createSyncedRegistry().getBuildings()

    expect(result).toHaveLength(2)
    expect(defined(result[0]).name).toBe('Alpha')
    expect(defined(result[1]).name).toBe('Bravo')
  })

  it('sets correct model and level for buildings', () => {
    const [alpha] = createSyncedRegistry().getBuildings()

    expect(defined(alpha).model).toBe('buildings')
    expect(defined(alpha).level).toBe(0)
  })

  it('includes floors, areas, and devices in hierarchy', () => {
    const bravo = createSyncedRegistry()
      .getBuildings()
      .find(({ name }) => name === 'Bravo')

    expect(bravo).toBeDefined()

    const floor = defined(defined(bravo).floors[0])

    expect(defined(bravo).floors).toHaveLength(1)
    expect(floor.name).toBe('Ground floor')
    expect(floor.areas).toHaveLength(1)

    const area = defined(floor.areas[0])

    expect(area.name).toBe('Salon')
    expect(area.devices).toHaveLength(1)
    expect(defined(area.devices[0]).name).toBe('AC unit')
  })

  it('puts building-level devices (no floor/area) directly on the building', () => {
    const bravo = defined(
      createSyncedRegistry()
        .getBuildings()
        .find(({ name }) => name === 'Bravo'),
    )

    expect(bravo.devices).toHaveLength(1)
    expect(defined(bravo.devices[0]).name).toBe('Heat pump')
  })

  it('filters by device type', () => {
    const registry = createSyncedRegistry()

    const ataBuildings = registry.getBuildings({ type: ClassicDeviceType.Ata })
    const atwBuildings = registry.getBuildings({ type: ClassicDeviceType.Atw })

    expect(ataBuildings).toHaveLength(2)
    expect(atwBuildings).toHaveLength(1)
    expect(defined(atwBuildings[0]).name).toBe('Bravo')
  })

  it('excludes buildings with no matching devices', () => {
    expect(
      createSyncedRegistry().getBuildings({ type: ClassicDeviceType.Erv }),
    ).toHaveLength(0)
  })

  it('sets correct levels for nested items', () => {
    const bravo = defined(
      createSyncedRegistry()
        .getBuildings()
        .find(({ name }) => name === 'Bravo'),
    )
    const floor = defined(bravo.floors[0])
    const area = defined(floor.areas[0])
    const device = defined(area.devices[0])

    expect(floor.level).toBe(1)
    expect(area.level).toBe(2)
    expect(device.level).toBe(3)
  })

  it('assigns level 1 to building-level devices', () => {
    const bravo = defined(
      createSyncedRegistry()
        .getBuildings()
        .find(({ name }) => name === 'Bravo'),
    )

    expect(defined(bravo.devices[0]).level).toBe(1)
  })
})

describe('zone retrieval', () => {
  it('returns a flat, sorted list of all zones', () => {
    const names = createSyncedRegistry()
      .getZones()
      .map(({ name }) => name)

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
    const atwZones = createSyncedRegistry().getZones({
      type: ClassicDeviceType.Atw,
    })

    expect(atwZones.map(({ name }) => name)).toStrictEqual([
      'Bravo',
      'Heat pump',
    ])
  })

  it('includes model type for each zone', () => {
    const models = createSyncedRegistry()
      .getZones()
      .map(({ model, name }) => ({ model, name }))

    expect(models).toContainEqual({ model: 'buildings', name: 'Alpha' })
    expect(models).toContainEqual({ model: 'floors', name: 'Ground floor' })
    expect(models).toContainEqual({ model: 'areas', name: 'Salon' })
    expect(models).toContainEqual({ model: 'devices', name: 'AC unit' })
  })

  it('returns empty list when no devices match', () => {
    expect(
      createSyncedRegistry().getZones({ type: ClassicDeviceType.Erv }),
    ).toHaveLength(0)
  })
})
