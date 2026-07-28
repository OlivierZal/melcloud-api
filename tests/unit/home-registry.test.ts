import { describe, expect, it } from 'vitest'

import { HomeDeviceType } from '../../src/constants.ts'
import {
  type TypedHomeDeviceData,
  HomeRegistry,
} from '../../src/entities/home-registry.ts'
import {
  homeBuildingRef,
  typedHomeAtwDeviceData,
  typedHomeDeviceData,
} from '../home-fixtures.ts'

const createDevice = (
  id: string,
  name = 'ClassicDevice',
): TypedHomeDeviceData => typedHomeDeviceData({ id, name })

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
})
