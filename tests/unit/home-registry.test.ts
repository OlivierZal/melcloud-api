import { defined } from '@olivierzal/api-core/testing'
import { describe, expect, it, vi } from 'vitest'

import { HomeDeviceType } from '../../src/constants.ts'
import {
  type TypedHomeDeviceData,
  HomeRegistry,
} from '../../src/entities/home-registry.ts'
import { STALE_COMMUNICATION_HOURS } from '../../src/entities/types.ts'
import { Temporal } from '../../src/temporal.ts'
import {
  homeBuildingRef,
  typedHomeAtwDeviceData,
  typedHomeDeviceData,
} from '../home-fixtures.ts'

const createDevice = (
  id: string,
  name = 'ClassicDevice',
): TypedHomeDeviceData => typedHomeDeviceData({ id, name })

const atwReading = (isConnected: boolean): TypedHomeDeviceData =>
  typedHomeAtwDeviceData({ id: 'atw-1', isConnected })

const pastStaleWindow = (
  since: Temporal.PlainDateTime,
): Temporal.PlainDateTime =>
  since.add({ hours: STALE_COMMUNICATION_HOURS, minutes: 1 })

describe('home device registry', () => {
  it('should sync new devices', () => {
    const registry = new HomeRegistry()
    registry.syncDevices([createDevice('a'), createDevice('b')])

    expect(registry.getDevices()).toHaveLength(2)
    expect(registry.getById('a')?.name).toBe('ClassicDevice')
  })

  it('should update existing devices in place', () => {
    const registry = new HomeRegistry()
    registry.syncDevices([createDevice('a', 'Old')])
    const model = registry.getById('a')
    registry.syncDevices([createDevice('a', 'New')])

    expect(registry.getById('a')).toBe(model)
    expect(model?.name).toBe('New')
  })

  it('should restate ownership on every sync', () => {
    const registry = new HomeRegistry()
    const { device, type } = createDevice('a')
    registry.syncDevices([
      { building: homeBuildingRef(), device, isOwner: false, type },
    ])

    expect(registry.getById('a')?.isOwner).toBe(false)

    registry.syncDevices([
      { building: homeBuildingRef(), device, isOwner: true, type },
    ])

    expect(registry.getById('a')?.isOwner).toBe(true)

    registry.syncDevices([
      { building: homeBuildingRef(), device, isOwner: false, type },
    ])

    expect(registry.getById('a')?.isOwner).toBe(false)
  })

  it('should prune stale devices', () => {
    const registry = new HomeRegistry()
    registry.syncDevices([createDevice('a'), createDevice('b')])
    registry.syncDevices([createDevice('a')])

    expect(registry.getDevices()).toHaveLength(1)
    expect(registry.getById('b')).toBeUndefined()
  })

  it('merges both connection types per building, name-sorted', () => {
    const registry = new HomeRegistry()
    registry.syncDevices([
      typedHomeDeviceData(
        { id: 'ata-1', name: 'ATA' },
        { building: homeBuildingRef({ id: 'b-2', name: 'Zeta' }) },
      ),
      typedHomeAtwDeviceData(
        { id: 'atw-1', name: 'ATW' },
        { building: homeBuildingRef({ id: 'b-2', name: 'Zeta' }) },
      ),
      typedHomeDeviceData(
        { id: 'ata-2', name: 'ATA 2' },
        { building: homeBuildingRef({ id: 'b-1', name: 'Alpha' }) },
      ),
    ])
    const buildings = registry.getBuildings()

    expect(buildings.map(({ name }) => name)).toStrictEqual(['Alpha', 'Zeta'])
    expect(buildings[1]?.devices).toHaveLength(2)
  })

  it('flattens buildings and devices into the picker zone list', () => {
    const registry = new HomeRegistry()
    registry.syncDevices([
      typedHomeDeviceData(
        { id: 'ata-1', name: 'Zulu' },
        { building: homeBuildingRef({ id: 'b-1', name: 'Alpha' }) },
      ),
      typedHomeAtwDeviceData(
        { id: 'atw-1', name: 'Echo' },
        { building: homeBuildingRef({ id: 'b-1', name: 'Alpha' }) },
      ),
    ])
    const zones = registry.getZones()

    expect(zones.map(({ id }) => id)).toStrictEqual(['b-1', 'atw-1', 'ata-1'])
    expect(zones[0]).toStrictEqual({
      buildingName: 'Alpha',
      hasAta: true,
      hasAtw: true,
      id: 'b-1',
      level: 0,
      model: 'homeBuildings',
      name: 'Alpha',
    })

    // The membership flags state the building's FULL membership, never
    // the filtered view's: a type-filtered picker still learns that a
    // bulk write on the mixed building would touch the other family.
    const [filtered] = registry.getZones({ type: HomeDeviceType.Ata })

    expect(filtered).toMatchObject({ hasAta: true, hasAtw: true })
    expect(zones[2]).toStrictEqual({
      buildingName: 'Alpha',
      deviceType: 'ata',
      id: 'ata-1',
      level: 1,
      model: 'homeDevices',
      name: 'Zulu',
    })
  })

  it('should filter by device type', () => {
    const registry = new HomeRegistry()
    registry.syncDevices([
      createDevice('ata-1', 'ATA'),
      typedHomeAtwDeviceData({ id: 'atw-1', name: 'ATW' }),
      createDevice('ata-2', 'ATA 2'),
    ])

    expect(registry.getDevicesByType(HomeDeviceType.Ata)).toHaveLength(2)
    expect(registry.getDevicesByType(HomeDeviceType.Atw)).toHaveLength(1)
  })

  // The sync answers the EDGES a unit's `isConnected` streak crosses, and
  // only those: the API client logs each one, so a steady state — connected
  // or a day into a disconnection — must stay silent, while a flag that
  // flaps is reported as the open/close pairs it produces.
  describe('connectivity transitions', () => {
    it('opens a streak with one `disconnected`, the constructing payload included', () => {
      const registry = new HomeRegistry()
      const events = registry.syncDevices([atwReading(false)])

      expect(events).toStrictEqual([
        {
          transition: { kind: 'disconnected' },
          unit: registry.getById('atw-1'),
        },
      ])
      expect(registry.syncDevices([atwReading(false)])).toStrictEqual([])
    })

    it('closes the streak with `reconnected`, carrying its start and its disconnected sync count', () => {
      const registry = new HomeRegistry()
      registry.syncDevices([atwReading(false)])
      const unit = defined(registry.getById('atw-1'))
      const since = defined(unit.disconnectedSince)
      registry.syncDevices([atwReading(false)])

      expect(registry.syncDevices([atwReading(true)])).toStrictEqual([
        { transition: { kind: 'reconnected', since, syncs: 2 }, unit },
      ])
      expect(unit.disconnectedSince).toBeNull()
    })

    it('reports `stale` exactly once per streak, on the first sync past the stale window', () => {
      const registry = new HomeRegistry()
      registry.syncDevices([atwReading(false)])
      const unit = defined(registry.getById('atw-1'))
      const since = defined(unit.disconnectedSince)
      const clock = vi
        .spyOn(Temporal.Now, 'plainDateTimeISO')
        .mockReturnValue(pastStaleWindow(since))
      try {
        expect(registry.syncDevices([atwReading(false)])).toStrictEqual([
          { transition: { kind: 'stale', since }, unit },
        ])
        expect(registry.syncDevices([atwReading(false)])).toStrictEqual([])
      } finally {
        clock.mockRestore()
      }
    })

    it('arms `stale` again for the next streak', () => {
      const registry = new HomeRegistry()
      registry.syncDevices([atwReading(false)])
      const unit = defined(registry.getById('atw-1'))
      const clock = vi.spyOn(Temporal.Now, 'plainDateTimeISO')
      const kinds = (isConnected: boolean): string[] =>
        registry
          .syncDevices([atwReading(isConnected)])
          .map(({ transition }) => transition.kind)
      try {
        clock.mockReturnValue(pastStaleWindow(defined(unit.disconnectedSince)))

        expect(kinds(false)).toStrictEqual(['stale'])
        expect(kinds(true)).toStrictEqual(['reconnected'])
        expect(kinds(false)).toStrictEqual(['disconnected'])

        clock.mockReturnValue(pastStaleWindow(defined(unit.disconnectedSince)))

        expect(kinds(false)).toStrictEqual(['stale'])
      } finally {
        clock.mockRestore()
      }
    })

    it('reports nothing for a unit that stays connected', () => {
      const registry = new HomeRegistry()

      expect(registry.syncDevices([atwReading(true)])).toStrictEqual([])
      expect(registry.syncDevices([atwReading(true)])).toStrictEqual([])
    })
  })
})
