import { cast, defined } from '@olivierzal/api-core/testing'
import { describe, expect, it } from 'vitest'

import type { ClassicListDeviceAny } from '../../src/types/index.ts'
import { ClassicDeviceType } from '../../src/constants.ts'
import {
  ClassicRegistry,
  isClassicDeviceOfType,
} from '../../src/entities/index.ts'
import { Temporal } from '../../src/temporal.ts'
import {
  classicAreaData,
  classicAreaId,
  classicAtaDevice,
  classicAtaDeviceData,
  classicAtwDevice,
  classicBuildingAreaData,
  classicBuildingData,
  classicBuildingId,
  classicErvDevice,
  classicFloorData,
  classicFloorId,
  populatedClassicRegistry,
} from '../classic-fixtures.ts'

const allBuildings = [
  classicBuildingData({ Name: 'ClassicBuilding 1' }),
  classicBuildingData({
    FPDefined: false,
    ID: 2,
    Location: 20,
    Name: 'ClassicBuilding 2',
  }),
]

const allFloors = [
  classicFloorData({ Name: 'ClassicFloor 1' }),
  classicFloorData({ ID: 11, Name: 'ClassicFloor 2' }),
  classicFloorData({ BuildingId: 2, ID: 12, Name: 'ClassicFloor 3' }),
]

const allAreas = [
  classicAreaData({ Name: 'ClassicArea 1' }),
  classicBuildingAreaData({ ID: 101, Name: 'ClassicArea 2' }),
  classicAreaData({
    BuildingId: 2,
    FloorId: 12,
    ID: 102,
    Name: 'ClassicArea 3',
  }),
]

const allDevices: ClassicListDeviceAny[] = [
  classicAtaDevice({ DeviceName: 'ClassicDevice ATA' }),
  classicAtwDevice({
    AreaID: 102,
    BuildingID: 2,
    DeviceName: 'ClassicDevice ATW',
    FloorID: 12,
  }),
  classicErvDevice({ AreaID: null, DeviceName: 'ClassicDevice ERV' }),
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
      const registry = populatedClassicRegistry(allFixtures)
      const ataBefore = registry.devices.getById(1000)
      const atwBefore = registry.devices.getById(1001)
      const ervBefore = registry.devices.getById(1002)

      registry.syncDevices([
        classicAtaDevice({ DeviceName: 'Updated ATA' }),
        classicAtwDevice({
          AreaID: 102,
          BuildingID: 2,
          DeviceName: 'Updated ATW',
          FloorID: 12,
        }),
        classicErvDevice({ AreaID: null, DeviceName: 'Updated ERV' }),
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

      // Re-sync each device ID with a mismatched Type to cover all false
      // branches
      registry.syncDevices([
        cast({
          ...classicAtaDevice(),
          DeviceName: 'Mismatched',
          Type: ClassicDeviceType.Atw,
        }),
        cast({
          ...classicAtwDevice(),
          DeviceName: 'Mismatched',
          Type: ClassicDeviceType.Erv,
        }),
        cast({
          ...classicErvDevice(),
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
      const registry = populatedClassicRegistry(allFixtures)

      expect(registry.getDevices()).toHaveLength(3)
    })

    it('getDevicesByType filters by device type', () => {
      const registry = populatedClassicRegistry(allFixtures)
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
      const registry = populatedClassicRegistry(allFixtures)
      const floors = registry.getFloorsByBuildingId(classicBuildingId(1))

      expect(floors).toHaveLength(2)
      expect(floors.map(({ name }) => name)).toStrictEqual([
        'ClassicFloor 1',
        'ClassicFloor 2',
      ])
    })

    it('getAreasByBuildingId returns areas belonging to a building', () => {
      const registry = populatedClassicRegistry(allFixtures)
      const areas = registry.getAreasByBuildingId(classicBuildingId(1))

      expect(areas).toHaveLength(2)
    })

    it('getAreasByFloorId returns areas belonging to a floor', () => {
      const registry = populatedClassicRegistry(allFixtures)

      expect(registry.getAreasByFloorId(classicFloorId(10))).toHaveLength(1)
      expect(registry.getAreasByFloorId(classicFloorId(11))).toHaveLength(0)
    })

    it('getDevicesByBuildingId returns devices belonging to a building', () => {
      const registry = populatedClassicRegistry(allFixtures)

      expect(
        registry.getDevicesByBuildingId(classicBuildingId(1)),
      ).toHaveLength(2)
      expect(
        registry.getDevicesByBuildingId(classicBuildingId(2)),
      ).toHaveLength(1)
    })

    it('getDevicesByFloorId returns devices belonging to a floor', () => {
      const registry = populatedClassicRegistry(allFixtures)

      expect(registry.getDevicesByFloorId(classicFloorId(10))).toHaveLength(1)
      expect(registry.getDevicesByFloorId(classicFloorId(11))).toHaveLength(0)
    })

    it('getDevicesByAreaId returns devices belonging to an area', () => {
      const registry = populatedClassicRegistry(allFixtures)

      expect(registry.getDevicesByAreaId(classicAreaId(100))).toHaveLength(1)
      expect(registry.getDevicesByAreaId(classicAreaId(101))).toHaveLength(0)
    })

    it('returns empty arrays for unknown building id', () => {
      const registry = populatedClassicRegistry(allFixtures)

      expect(
        registry.getFloorsByBuildingId(classicBuildingId(999)),
      ).toHaveLength(0)
      expect(
        registry.getAreasByBuildingId(classicBuildingId(999)),
      ).toHaveLength(0)
      expect(
        registry.getDevicesByBuildingId(classicBuildingId(999)),
      ).toHaveLength(0)
    })
  })
})

// A unit's last communication is building-local wall clock, judged
// against a UTC anchor at day scale: the stamps below are that far
// behind now, the way the availability contract builds them.
const heardFrom = (hoursAgo: number): string =>
  Temporal.Now.plainDateTimeISO('UTC').subtract({ hours: hoursAgo }).toString()

const unitHeardFrom = (lastTimestamp: string): ClassicListDeviceAny =>
  classicAtaDevice({
    Device: classicAtaDeviceData({ LastTimeStamp: lastTimestamp }),
  })

const emptyRegistry = (): ClassicRegistry =>
  populatedClassicRegistry({
    areas: [classicAreaData()],
    buildings: [classicBuildingData()],
    floors: [classicFloorData()],
  })

describe('the communication edges a device sync answers', () => {
  it('answers none for a unit heard from within the day', () => {
    const registry = emptyRegistry()

    expect(registry.syncDevices([unitHeardFrom(heardFrom(1))])).toStrictEqual(
      [],
    )
    expect(registry.syncDevices([unitHeardFrom(heardFrom(23))])).toStrictEqual(
      [],
    )
  })

  it('answers `stale` once for a unit that joins silent for over a day', () => {
    const registry = emptyRegistry()
    const lastTimestamp = heardFrom(25)

    const events = registry.syncDevices([unitHeardFrom(lastTimestamp)])

    expect(events).toStrictEqual([
      {
        transition: { kind: 'stale', lastTimestamp },
        unit: registry.devices.getById(1000),
      },
    ])
    expect(registry.syncDevices([unitHeardFrom(lastTimestamp)])).toStrictEqual(
      [],
    )
  })

  it('answers `stale` when a known unit goes silent for over a day', () => {
    const registry = emptyRegistry()
    registry.syncDevices([unitHeardFrom(heardFrom(1))])
    const lastTimestamp = heardFrom(30)

    expect(registry.syncDevices([unitHeardFrom(lastTimestamp)])).toStrictEqual([
      {
        transition: { kind: 'stale', lastTimestamp },
        unit: registry.devices.getById(1000),
      },
    ])
  })

  it('answers `resumed` once when a silent unit is heard from again', () => {
    const registry = emptyRegistry()
    registry.syncDevices([unitHeardFrom(heardFrom(48))])
    const lastTimestamp = heardFrom(0)

    expect(registry.syncDevices([unitHeardFrom(lastTimestamp)])).toStrictEqual([
      {
        transition: { kind: 'resumed', lastTimestamp },
        unit: registry.devices.getById(1000),
      },
    ])
    expect(registry.syncDevices([unitHeardFrom(lastTimestamp)])).toStrictEqual(
      [],
    )
  })

  // A stamp that cannot be read says nothing either way: no edge, and
  // the verdict of the last stamp that could be read stands. Read as a
  // unit heard from, it used to close the episode of a silent unit
  // ("communicates again, last at null") and open it again at the next
  // listing.
  it('answers none for a stamp it cannot read', () => {
    const registry = emptyRegistry()

    expect(registry.syncDevices([unitHeardFrom('not a date')])).toStrictEqual(
      [],
    )
  })

  it.each(['not a date', '', '2026-11-23T11:59:00Z'])(
    'keeps a silent unit silent across the unreadable stamp %j',
    (unreadable) => {
      const registry = emptyRegistry()
      const lastTimestamp = heardFrom(48)
      registry.syncDevices([unitHeardFrom(lastTimestamp)])

      expect(registry.syncDevices([unitHeardFrom(unreadable)])).toStrictEqual(
        [],
      )
      expect(
        registry.syncDevices([unitHeardFrom(lastTimestamp)]),
      ).toStrictEqual([])
    },
  )

  // A unit pruned from the listing takes its record with it: listed
  // again and still silent, it is a unit that joins silent.
  it('answers `stale` again for a silent unit that left the listing and came back', () => {
    const registry = emptyRegistry()
    const lastTimestamp = heardFrom(25)
    registry.syncDevices([unitHeardFrom(lastTimestamp)])
    registry.syncDevices([])

    expect(registry.syncDevices([unitHeardFrom(lastTimestamp)])).toHaveLength(1)
  })
})

describe(isClassicDeviceOfType, () => {
  it('narrows device to specific type', () => {
    const registry = populatedClassicRegistry(allFixtures)
    const device = defined(registry.devices.getById(1000))

    expect(isClassicDeviceOfType(device, ClassicDeviceType.Ata)).toBe(true)
    expect(isClassicDeviceOfType(device, ClassicDeviceType.Atw)).toBe(false)
  })
})
