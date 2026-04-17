import { describe, expect, it } from 'vitest'

import { ClassicDeviceType } from '../../src/constants.ts'
import {
  ClassicRegistry,
  isClassicDeviceOfType,
} from '../../src/entities/index.ts'
import {
  type ClassicListDeviceAny,
  toClassicAreaId,
  toClassicBuildingId,
  toClassicFloorId,
} from '../../src/types/index.ts'
import {
  areaData,
  ataDevice,
  atwDevice,
  buildingData,
  ervDevice,
  floorData,
} from '../fixtures.ts'
import { cast, createPopulatedRegistry, defined } from '../helpers.ts'

const allBuildings = [
  buildingData({ Name: 'ClassicBuilding 1' }),
  buildingData({
    FPDefined: false,
    ID: toClassicBuildingId(2),
    Location: 20,
    Name: 'ClassicBuilding 2',
  }),
]

const allFloors = [
  floorData({ Name: 'ClassicFloor 1' }),
  floorData({ ID: 11, Name: 'ClassicFloor 2' }),
  floorData({
    BuildingId: toClassicBuildingId(2),
    ID: 12,
    Name: 'ClassicFloor 3',
  }),
]

const allAreas = [
  areaData({ Name: 'ClassicArea 1' }),
  areaData({ FloorId: null, ID: 101, Name: 'ClassicArea 2' }),
  areaData({
    BuildingId: toClassicBuildingId(2),
    FloorId: 12,
    ID: 102,
    Name: 'ClassicArea 3',
  }),
]

const allDevices: ClassicListDeviceAny[] = [
  ataDevice({ DeviceName: 'ClassicDevice ATA' }),
  atwDevice({
    AreaID: toClassicAreaId(102),
    BuildingID: toClassicBuildingId(2),
    DeviceName: 'ClassicDevice ATW',
    FloorID: toClassicFloorId(12),
  }),
  ervDevice({ AreaID: null, DeviceName: 'ClassicDevice ERV' }),
]

const allFixtures = {
  areas: allAreas,
  buildings: allBuildings,
  devices: allDevices,
  floors: allFloors,
}

describe('model registry', () => {
  describe('sync', () => {
    it('syncs buildings', () => {
      const registry = new ClassicRegistry()
      registry.syncBuildings(allBuildings)

      expect(registry.buildings.getById(1)?.name).toBe('ClassicBuilding 1')
      expect(registry.buildings.getById(2)?.name).toBe('ClassicBuilding 2')
      expect(registry.buildings.getById(999)).toBeUndefined()
    })

    it('syncs floors', () => {
      const registry = new ClassicRegistry()
      registry.syncFloors(allFloors)

      expect(registry.floors.getById(10)?.name).toBe('ClassicFloor 1')
      expect(registry.floors.getById(11)?.buildingId).toBe(1)
    })

    it('syncs areas', () => {
      const registry = new ClassicRegistry()
      registry.syncAreas(allAreas)

      expect(registry.areas.getById(100)?.name).toBe('ClassicArea 1')
      expect(registry.areas.getById(100)?.floorId).toBe(10)
      expect(registry.areas.getById(101)?.floorId).toBeNull()
    })

    it('syncs devices', () => {
      const registry = new ClassicRegistry()
      registry.syncDevices(allDevices)

      expect(registry.devices.getById(1000)?.name).toBe('ClassicDevice ATA')
      expect(registry.devices.getById(1000)?.type).toBe(ClassicDeviceType.Ata)
    })

    it('updates data in-place on re-sync, preserving identity', () => {
      const registry = new ClassicRegistry()
      registry.syncBuildings(allBuildings)
      const buildingBefore = registry.buildings.getById(1)

      expect(buildingBefore?.name).toBe('ClassicBuilding 1')

      registry.syncBuildings([
        { ...defined(allBuildings[0]), Name: 'Updated ClassicBuilding' },
      ])
      const buildingAfter = registry.buildings.getById(1)

      expect(buildingAfter?.name).toBe('Updated ClassicBuilding')
      expect(buildingAfter).toBe(buildingBefore)
      expect(registry.buildings.getById(2)).toBeUndefined()
    })

    it('updates devices in-place on re-sync for all device types', () => {
      const registry = createPopulatedRegistry(allFixtures)
      const ataBefore = registry.devices.getById(1000)
      const atwBefore = registry.devices.getById(1001)
      const ervBefore = registry.devices.getById(1002)

      registry.syncDevices([
        ataDevice({ DeviceName: 'Updated ATA' }),
        atwDevice({
          AreaID: toClassicAreaId(102),
          BuildingID: toClassicBuildingId(2),
          DeviceName: 'Updated ATW',
          FloorID: toClassicFloorId(12),
        }),
        ervDevice({ AreaID: null, DeviceName: 'Updated ERV' }),
      ])

      expect(registry.devices.getById(1000)).toBe(ataBefore)
      expect(registry.devices.getById(1000)?.name).toBe('Updated ATA')
      expect(registry.devices.getById(1001)).toBe(atwBefore)
      expect(registry.devices.getById(1001)?.name).toBe('Updated ATW')
      expect(registry.devices.getById(1002)).toBe(ervBefore)
      expect(registry.devices.getById(1002)?.name).toBe('Updated ERV')
    })

    it('skips sync when device type changes between syncs', () => {
      const registry = new ClassicRegistry()
      registry.syncDevices(allDevices)

      // Re-sync each device ID with a mismatched Type to cover all false branches
      registry.syncDevices([
        cast({
          ...ataDevice(),
          DeviceName: 'Mismatched',
          Type: ClassicDeviceType.Atw,
        }),
        cast({
          ...atwDevice(),
          DeviceName: 'Mismatched',
          Type: ClassicDeviceType.Erv,
        }),
        cast({
          ...ervDevice(),
          DeviceName: 'Mismatched',
          Type: ClassicDeviceType.Ata,
        }),
      ])

      expect(registry.devices.getById(1000)?.name).toBe('ClassicDevice ATA')
      expect(registry.devices.getById(1001)?.name).toBe('ClassicDevice ATW')
      expect(registry.devices.getById(1002)?.name).toBe('ClassicDevice ERV')
    })
  })

  describe('queries', () => {
    it('getDevices returns all devices', () => {
      const registry = createPopulatedRegistry(allFixtures)

      expect(registry.getDevices()).toHaveLength(3)
    })

    it('getDevicesByType filters by device type', () => {
      const registry = createPopulatedRegistry(allFixtures)
      const ataDevices = registry.getDevicesByType(ClassicDeviceType.Ata)

      expect(ataDevices).toHaveLength(1)
      expect(ataDevices[0]?.type).toBe(ClassicDeviceType.Ata)
    })

    it('getDevicesByType returns empty for absent type', () => {
      const registry = new ClassicRegistry()
      registry.syncDevices([defined(allDevices[0])])

      expect(registry.getDevicesByType(ClassicDeviceType.Atw)).toHaveLength(0)
    })
  })

  describe('cross-references', () => {
    it('getFloorsByBuildingId returns floors belonging to a building', () => {
      const registry = createPopulatedRegistry(allFixtures)
      const floors = registry.getFloorsByBuildingId(toClassicBuildingId(1))

      expect(floors).toHaveLength(2)
      expect(floors.map(({ name }) => name)).toStrictEqual([
        'ClassicFloor 1',
        'ClassicFloor 2',
      ])
    })

    it('getAreasByBuildingId returns areas belonging to a building', () => {
      const registry = createPopulatedRegistry(allFixtures)
      const areas = registry.getAreasByBuildingId(toClassicBuildingId(1))

      expect(areas).toHaveLength(2)
    })

    it('getAreasByFloorId returns areas belonging to a floor', () => {
      const registry = createPopulatedRegistry(allFixtures)

      expect(registry.getAreasByFloorId(toClassicFloorId(10))).toHaveLength(1)
      expect(registry.getAreasByFloorId(toClassicFloorId(11))).toHaveLength(0)
    })

    it('getDevicesByBuildingId returns devices belonging to a building', () => {
      const registry = createPopulatedRegistry(allFixtures)

      expect(
        registry.getDevicesByBuildingId(toClassicBuildingId(1)),
      ).toHaveLength(2)
      expect(
        registry.getDevicesByBuildingId(toClassicBuildingId(2)),
      ).toHaveLength(1)
    })

    it('getDevicesByFloorId returns devices belonging to a floor', () => {
      const registry = createPopulatedRegistry(allFixtures)

      expect(registry.getDevicesByFloorId(toClassicFloorId(10))).toHaveLength(1)
      expect(registry.getDevicesByFloorId(toClassicFloorId(11))).toHaveLength(0)
    })

    it('getDevicesByAreaId returns devices belonging to an area', () => {
      const registry = createPopulatedRegistry(allFixtures)

      expect(registry.getDevicesByAreaId(toClassicAreaId(100))).toHaveLength(1)
      expect(registry.getDevicesByAreaId(toClassicAreaId(101))).toHaveLength(0)
    })

    it('returns empty arrays for unknown building id', () => {
      const registry = createPopulatedRegistry(allFixtures)

      expect(
        registry.getFloorsByBuildingId(toClassicBuildingId(999)),
      ).toHaveLength(0)
      expect(
        registry.getAreasByBuildingId(toClassicBuildingId(999)),
      ).toHaveLength(0)
      expect(
        registry.getDevicesByBuildingId(toClassicBuildingId(999)),
      ).toHaveLength(0)
    })
  })
})

describe(isClassicDeviceOfType, () => {
  it('narrows device to specific type', () => {
    const registry = createPopulatedRegistry(allFixtures)
    const device = defined(registry.devices.getById(1000))

    expect(isClassicDeviceOfType(device, ClassicDeviceType.Ata)).toBe(true)
    expect(isClassicDeviceOfType(device, ClassicDeviceType.Atw)).toBe(false)
  })
})
