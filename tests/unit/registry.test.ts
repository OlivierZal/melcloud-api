import { describe, expect, it } from 'vitest'

import type {
  AreaDataAny,
  BuildingData,
  FloorData,
  ListDeviceAny,
} from '../../src/types/index.ts'

import { DeviceType } from '../../src/enums.ts'
import { ModelRegistry } from '../../src/models/index.ts'

const buildingData: BuildingData[] = [
  {
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
    Name: 'Building 1',
  },
  {
    FPDefined: false,
    FPEnabled: false,
    FPMaxTemperature: 16,
    FPMinTemperature: 4,
    HMDefined: false,
    HMEnabled: false,
    HMEndDate: null,
    HMStartDate: null,
    ID: 2,
    Location: 20,
    Name: 'Building 2',
  },
]

const floorData: FloorData[] = [
  { BuildingId: 1, ID: 10, Name: 'Floor 1' },
  { BuildingId: 1, ID: 11, Name: 'Floor 2' },
  { BuildingId: 2, ID: 12, Name: 'Floor 3' },
]

const areaData: AreaDataAny[] = [
  { BuildingId: 1, FloorId: 10, ID: 100, Name: 'Area 1' },
  { BuildingId: 1, FloorId: null, ID: 101, Name: 'Area 2' },
  { BuildingId: 2, FloorId: 12, ID: 102, Name: 'Area 3' },
]

const deviceData: ListDeviceAny[] = [
  {
    AreaID: 100,
    BuildingID: 1,
    Device: {} as ListDeviceAny['Device'],
    DeviceID: 1000,
    DeviceName: 'Device ATA',
    FloorID: 10,
    Type: DeviceType.Ata,
  },
  {
    AreaID: 102,
    BuildingID: 2,
    Device: {} as ListDeviceAny['Device'],
    DeviceID: 1001,
    DeviceName: 'Device ATW',
    FloorID: 12,
    Type: DeviceType.Atw,
  },
  {
    AreaID: null,
    BuildingID: 1,
    Device: {} as ListDeviceAny['Device'],
    DeviceID: 1002,
    DeviceName: 'Device ERV',
    FloorID: null,
    Type: DeviceType.Erv,
  },
]

const createPopulatedRegistry = (): ModelRegistry => {
  const registry = new ModelRegistry()
  registry.syncBuildings(buildingData)
  registry.syncFloors(floorData)
  registry.syncAreas(areaData)
  registry.syncDevices(deviceData)
  return registry
}

describe('modelRegistry', () => {
  describe('sync', () => {
    it('syncs buildings', () => {
      const registry = new ModelRegistry()
      registry.syncBuildings(buildingData)

      expect(registry.buildings.getById(1)?.name).toBe('Building 1')
      expect(registry.buildings.getById(2)?.name).toBe('Building 2')
      expect(registry.buildings.getById(999)).toBeUndefined()
    })

    it('syncs floors', () => {
      const registry = new ModelRegistry()
      registry.syncFloors(floorData)

      expect(registry.floors.getById(10)?.name).toBe('Floor 1')
      expect(registry.floors.getById(11)?.buildingId).toBe(1)
    })

    it('syncs areas', () => {
      const registry = new ModelRegistry()
      registry.syncAreas(areaData)

      expect(registry.areas.getById(100)?.name).toBe('Area 1')
      expect(registry.areas.getById(100)?.floorId).toBe(10)
      expect(registry.areas.getById(101)?.floorId).toBeNull()
    })

    it('syncs devices', () => {
      const registry = new ModelRegistry()
      registry.syncDevices(deviceData)

      expect(registry.devices.getById(1000)?.name).toBe('Device ATA')
      expect(registry.devices.getById(1000)?.type).toBe(DeviceType.Ata)
    })

    it('replaces previous data on re-sync', () => {
      const registry = new ModelRegistry()
      registry.syncBuildings(buildingData)

      expect(registry.buildings.getById(1)?.name).toBe('Building 1')

      registry.syncBuildings([
        { ...buildingData[0]!, Name: 'Updated Building' },
      ])

      expect(registry.buildings.getById(1)?.name).toBe('Updated Building')
      expect(registry.buildings.getById(2)).toBeUndefined()
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
      registry.syncDevices([deviceData[0]!])

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
