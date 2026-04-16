import { describe, expect, it } from 'vitest'

import { ClassicDeviceType } from '../../src/constants.ts'
import { ClassicRegistry, isDeviceOfType } from '../../src/entities/index.ts'
import {
  type ClassicListDeviceAny,
  type ListDevice,
  type ListDeviceDataAta,
  toAreaId,
  toBuildingId,
  toDeviceId,
  toFloorId,
} from '../../src/types/index.ts'
import {
  areaData,
  ataDevice,
  atwDevice,
  buildingData,
  ervDevice,
  floorData,
} from '../fixtures.ts'
import { cast, createPopulatedRegistry, defined, mock } from '../helpers.ts'

const allBuildings = [
  buildingData({ Name: 'Building 1' }),
  buildingData({
    FPDefined: false,
    ID: toBuildingId(2),
    Location: 20,
    Name: 'Building 2',
  }),
]

const allFloors = [
  floorData({ Name: 'Floor 1' }),
  floorData({ ID: 11, Name: 'Floor 2' }),
  floorData({ BuildingId: toBuildingId(2), ID: 12, Name: 'Floor 3' }),
]

const allAreas = [
  areaData({ Name: 'Area 1' }),
  areaData({ FloorId: null, ID: 101, Name: 'Area 2' }),
  areaData({
    BuildingId: toBuildingId(2),
    FloorId: 12,
    ID: 102,
    Name: 'Area 3',
  }),
]

const allDevices: ClassicListDeviceAny[] = [
  ataDevice({ DeviceName: 'ClassicDevice ATA' }),
  atwDevice({
    AreaID: toAreaId(102),
    BuildingID: toBuildingId(2),
    DeviceName: 'ClassicDevice ATW',
    FloorID: toFloorId(12),
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

      expect(registry.buildings.getById(1)?.name).toBe('Building 1')
      expect(registry.buildings.getById(2)?.name).toBe('Building 2')
      expect(registry.buildings.getById(999)).toBeUndefined()
    })

    it('syncs floors', () => {
      const registry = new ClassicRegistry()
      registry.syncFloors(allFloors)

      expect(registry.floors.getById(10)?.name).toBe('Floor 1')
      expect(registry.floors.getById(11)?.buildingId).toBe(1)
    })

    it('syncs areas', () => {
      const registry = new ClassicRegistry()
      registry.syncAreas(allAreas)

      expect(registry.areas.getById(100)?.name).toBe('Area 1')
      expect(registry.areas.getById(100)?.floorId).toBe(10)
      expect(registry.areas.getById(101)?.floorId).toBeNull()
    })

    it('syncs devices', () => {
      const registry = new ClassicRegistry()
      registry.syncDevices(allDevices)

      expect(registry.devices.getById(1000)?.name).toBe('ClassicDevice ATA')
      expect(registry.devices.getById(1000)?.type).toBe(ClassicDeviceType.Ata)
    })

    it('throws for unsupported device type', () => {
      const registry = new ClassicRegistry()
      const invalidDevice = mock<ListDevice<0>>({
        AreaID: null,
        BuildingID: toBuildingId(1),
        ClassicDevice: mock<ListDeviceDataAta>(),
        DeviceID: toDeviceId(9999),
        DeviceName: 'Invalid',
        FloorID: null,
        Type: cast(999),
      }) as ClassicListDeviceAny

      expect(() => {
        registry.syncDevices([invalidDevice])
      }).toThrow('Unsupported device type: 999')
    })

    it('serializes object-typed device type without losing information', () => {
      /*
       * Defensive: if a corrupted response produces a non-primitive Type
       * field, the error message must still convey what was received
       * rather than collapse to `[object Object]`.
       */
      const registry = new ClassicRegistry()
      const invalidDevice = mock<ListDevice<0>>({
        AreaID: null,
        BuildingID: toBuildingId(1),
        ClassicDevice: mock<ListDeviceDataAta>(),
        DeviceID: toDeviceId(9999),
        DeviceName: 'Invalid',
        FloorID: null,
        Type: cast({ nested: 'value' }),
      }) as ClassicListDeviceAny

      expect(() => {
        registry.syncDevices([invalidDevice])
      }).toThrow('Unsupported device type: {"nested":"value"}')
    })

    it('updates data in-place on re-sync, preserving identity', () => {
      const registry = new ClassicRegistry()
      registry.syncBuildings(allBuildings)
      const buildingBefore = registry.buildings.getById(1)

      expect(buildingBefore?.name).toBe('Building 1')

      registry.syncBuildings([
        { ...defined(allBuildings[0]), Name: 'Updated Building' },
      ])
      const buildingAfter = registry.buildings.getById(1)

      expect(buildingAfter?.name).toBe('Updated Building')
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
          AreaID: toAreaId(102),
          BuildingID: toBuildingId(2),
          DeviceName: 'Updated ATW',
          FloorID: toFloorId(12),
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
      const floors = registry.getFloorsByBuildingId(toBuildingId(1))

      expect(floors).toHaveLength(2)
      expect(floors.map(({ name }) => name)).toStrictEqual([
        'Floor 1',
        'Floor 2',
      ])
    })

    it('getAreasByBuildingId returns areas belonging to a building', () => {
      const registry = createPopulatedRegistry(allFixtures)
      const areas = registry.getAreasByBuildingId(toBuildingId(1))

      expect(areas).toHaveLength(2)
    })

    it('getAreasByFloorId returns areas belonging to a floor', () => {
      const registry = createPopulatedRegistry(allFixtures)

      expect(registry.getAreasByFloorId(toFloorId(10))).toHaveLength(1)
      expect(registry.getAreasByFloorId(toFloorId(11))).toHaveLength(0)
    })

    it('getDevicesByBuildingId returns devices belonging to a building', () => {
      const registry = createPopulatedRegistry(allFixtures)

      expect(registry.getDevicesByBuildingId(toBuildingId(1))).toHaveLength(2)
      expect(registry.getDevicesByBuildingId(toBuildingId(2))).toHaveLength(1)
    })

    it('getDevicesByFloorId returns devices belonging to a floor', () => {
      const registry = createPopulatedRegistry(allFixtures)

      expect(registry.getDevicesByFloorId(toFloorId(10))).toHaveLength(1)
      expect(registry.getDevicesByFloorId(toFloorId(11))).toHaveLength(0)
    })

    it('getDevicesByAreaId returns devices belonging to an area', () => {
      const registry = createPopulatedRegistry(allFixtures)

      expect(registry.getDevicesByAreaId(toAreaId(100))).toHaveLength(1)
      expect(registry.getDevicesByAreaId(toAreaId(101))).toHaveLength(0)
    })

    it('returns empty arrays for unknown building id', () => {
      const registry = createPopulatedRegistry(allFixtures)

      expect(registry.getFloorsByBuildingId(toBuildingId(999))).toHaveLength(0)
      expect(registry.getAreasByBuildingId(toBuildingId(999))).toHaveLength(0)
      expect(registry.getDevicesByBuildingId(toBuildingId(999))).toHaveLength(0)
    })
  })
})

describe(isDeviceOfType, () => {
  it('narrows device to specific type', () => {
    const registry = createPopulatedRegistry(allFixtures)
    const device = defined(registry.devices.getById(1000))

    expect(isDeviceOfType(device, ClassicDeviceType.Ata)).toBe(true)
    expect(isDeviceOfType(device, ClassicDeviceType.Atw)).toBe(false)
  })
})
