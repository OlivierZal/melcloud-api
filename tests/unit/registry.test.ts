import { describe, expect, it } from 'vitest'

import type {
  ListDevice,
  ListDeviceAny,
  ListDeviceDataAta,
} from '../../src/types/index.ts'
import { DeviceType } from '../../src/constants.ts'
import { isDeviceOfType, ModelRegistry } from '../../src/models/index.ts'
import {
  areaData,
  ataDevice,
  atwDevice,
  buildingData,
  ervDevice,
  floorData,
} from '../fixtures.ts'
import { cast, defined, mock } from '../helpers.ts'

const allBuildings = [
  buildingData({ Name: 'Building 1' }),
  buildingData({
    FPDefined: false,
    ID: 2,
    Location: 20,
    Name: 'Building 2',
  }),
]

const allFloors = [
  floorData({ Name: 'Floor 1' }),
  floorData({ ID: 11, Name: 'Floor 2' }),
  floorData({ BuildingId: 2, ID: 12, Name: 'Floor 3' }),
]

const allAreas = [
  areaData({ Name: 'Area 1' }),
  areaData({ FloorId: null, ID: 101, Name: 'Area 2' }),
  areaData({ BuildingId: 2, FloorId: 12, ID: 102, Name: 'Area 3' }),
]

const allDevices: ListDeviceAny[] = [
  ataDevice({ DeviceName: 'Device ATA' }),
  atwDevice({
    AreaID: 102,
    BuildingID: 2,
    DeviceName: 'Device ATW',
    FloorID: 12,
  }),
  ervDevice({ AreaID: null, DeviceName: 'Device ERV' }),
]

const createPopulatedRegistry = (): ModelRegistry => {
  const registry = new ModelRegistry()
  registry.syncBuildings(allBuildings)
  registry.syncFloors(allFloors)
  registry.syncAreas(allAreas)
  registry.syncDevices(allDevices)
  return registry
}

describe('model registry', () => {
  describe('sync', () => {
    it('syncs buildings', () => {
      const registry = new ModelRegistry()
      registry.syncBuildings(allBuildings)

      expect(registry.buildings.getById(1)?.name).toBe('Building 1')
      expect(registry.buildings.getById(2)?.name).toBe('Building 2')
      expect(registry.buildings.getById(999)).toBeUndefined()
    })

    it('syncs floors', () => {
      const registry = new ModelRegistry()
      registry.syncFloors(allFloors)

      expect(registry.floors.getById(10)?.name).toBe('Floor 1')
      expect(registry.floors.getById(11)?.buildingId).toBe(1)
    })

    it('syncs areas', () => {
      const registry = new ModelRegistry()
      registry.syncAreas(allAreas)

      expect(registry.areas.getById(100)?.name).toBe('Area 1')
      expect(registry.areas.getById(100)?.floorId).toBe(10)
      expect(registry.areas.getById(101)?.floorId).toBeNull()
    })

    it('syncs devices', () => {
      const registry = new ModelRegistry()
      registry.syncDevices(allDevices)

      expect(registry.devices.getById(1000)?.name).toBe('Device ATA')
      expect(registry.devices.getById(1000)?.type).toBe(DeviceType.Ata)
    })

    it('throws for unsupported device type', () => {
      const registry = new ModelRegistry()
      const invalidDevice = mock<ListDevice<0>>({
        AreaID: null,
        BuildingID: 1,
        Device: mock<ListDeviceDataAta>(),
        DeviceID: 9999,
        DeviceName: 'Invalid',
        FloorID: null,
        Type: cast(999),
      }) as ListDeviceAny

      expect(() => {
        registry.syncDevices([invalidDevice])
      }).toThrow(/Unsupported device type/u)
    })

    it('updates data in-place on re-sync, preserving identity', () => {
      const registry = new ModelRegistry()
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
      const registry = createPopulatedRegistry()
      const ataBefore = registry.devices.getById(1000)
      const atwBefore = registry.devices.getById(1001)
      const ervBefore = registry.devices.getById(1002)

      registry.syncDevices([
        ataDevice({ DeviceName: 'Updated ATA' }),
        atwDevice({
          AreaID: 102,
          BuildingID: 2,
          DeviceName: 'Updated ATW',
          FloorID: 12,
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
      const registry = new ModelRegistry()
      registry.syncDevices(allDevices)

      // Re-sync each device ID with a mismatched Type to cover all false branches
      registry.syncDevices([
        cast({
          ...ataDevice(),
          DeviceName: 'Mismatched',
          Type: DeviceType.Atw,
        }),
        cast({
          ...atwDevice(),
          DeviceName: 'Mismatched',
          Type: DeviceType.Erv,
        }),
        cast({
          ...ervDevice(),
          DeviceName: 'Mismatched',
          Type: DeviceType.Ata,
        }),
      ])

      expect(registry.devices.getById(1000)?.name).toBe('Device ATA')
      expect(registry.devices.getById(1001)?.name).toBe('Device ATW')
      expect(registry.devices.getById(1002)?.name).toBe('Device ERV')
    })
  })

  describe('queries', () => {
    it('getDevices returns all devices', () => {
      const registry = createPopulatedRegistry()

      expect(registry.getDevices()).toHaveLength(3)
    })

    it('getDevicesByType filters by device type', () => {
      const registry = createPopulatedRegistry()
      const ataDevices = registry.getDevicesByType(DeviceType.Ata)

      expect(ataDevices).toHaveLength(1)
      expect(ataDevices[0]?.type).toBe(DeviceType.Ata)
    })

    it('getDevicesByType returns empty for absent type', () => {
      const registry = new ModelRegistry()
      registry.syncDevices([defined(allDevices[0])])

      expect(registry.getDevicesByType(DeviceType.Atw)).toHaveLength(0)
    })
  })

  describe('cross-references', () => {
    it('getFloorsByBuildingId returns floors belonging to a building', () => {
      const registry = createPopulatedRegistry()
      const floors = registry.getFloorsByBuildingId(1)

      expect(floors).toHaveLength(2)
      expect(floors.map(({ name }) => name)).toStrictEqual([
        'Floor 1',
        'Floor 2',
      ])
    })

    it('getAreasByBuildingId returns areas belonging to a building', () => {
      const registry = createPopulatedRegistry()
      const areas = registry.getAreasByBuildingId(1)

      expect(areas).toHaveLength(2)
    })

    it('getAreasByFloorId returns areas belonging to a floor', () => {
      const registry = createPopulatedRegistry()

      expect(registry.getAreasByFloorId(10)).toHaveLength(1)
      expect(registry.getAreasByFloorId(11)).toHaveLength(0)
    })

    it('getDevicesByBuildingId returns devices belonging to a building', () => {
      const registry = createPopulatedRegistry()

      expect(registry.getDevicesByBuildingId(1)).toHaveLength(2)
      expect(registry.getDevicesByBuildingId(2)).toHaveLength(1)
    })

    it('getDevicesByFloorId returns devices belonging to a floor', () => {
      const registry = createPopulatedRegistry()

      expect(registry.getDevicesByFloorId(10)).toHaveLength(1)
      expect(registry.getDevicesByFloorId(11)).toHaveLength(0)
    })

    it('getDevicesByAreaId returns devices belonging to an area', () => {
      const registry = createPopulatedRegistry()

      expect(registry.getDevicesByAreaId(100)).toHaveLength(1)
      expect(registry.getDevicesByAreaId(101)).toHaveLength(0)
    })

    it('returns empty arrays for unknown building id', () => {
      const registry = createPopulatedRegistry()

      expect(registry.getFloorsByBuildingId(999)).toHaveLength(0)
      expect(registry.getAreasByBuildingId(999)).toHaveLength(0)
      expect(registry.getDevicesByBuildingId(999)).toHaveLength(0)
    })
  })
})

describe(isDeviceOfType, () => {
  it('narrows device to specific type', () => {
    const registry = createPopulatedRegistry()
    const device = defined(registry.devices.getById(1000))

    expect(isDeviceOfType(device, DeviceType.Ata)).toBe(true)
    expect(isDeviceOfType(device, DeviceType.Atw)).toBe(false)
  })
})
