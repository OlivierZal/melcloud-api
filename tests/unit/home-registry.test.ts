import { describe, expect, it } from 'vitest'

import { HomeDeviceType } from '../../src/constants.ts'
import {
  type TypedHomeDeviceData,
  HomeRegistry,
} from '../../src/entities/home-registry.ts'
import { typedHomeDeviceData } from '../home-fixtures.ts'

const createDevice = (
  id: string,
  name = 'ClassicDevice',
  type: HomeDeviceType = HomeDeviceType.Ata,
): TypedHomeDeviceData => typedHomeDeviceData({ id, name }, type)

describe('home device registry', () => {
  it('should sync new devices', () => {
    const registry = new HomeRegistry()
    registry.sync([createDevice('a'), createDevice('b')])

    expect(registry.getAll()).toHaveLength(2)
    expect(registry.getById('a')?.name).toBe('ClassicDevice')
  })

  it('should update existing devices in place', () => {
    const registry = new HomeRegistry()
    registry.sync([createDevice('a', 'Old')])
    const model = registry.getById('a')
    registry.sync([createDevice('a', 'New')])

    expect(registry.getById('a')).toBe(model)
    expect(model?.name).toBe('New')
  })

  it('should prune stale devices', () => {
    const registry = new HomeRegistry()
    registry.sync([createDevice('a'), createDevice('b')])
    registry.sync([createDevice('a')])

    expect(registry.getAll()).toHaveLength(1)
    expect(registry.getById('b')).toBeUndefined()
  })

  it('should filter by device type', () => {
    const registry = new HomeRegistry()
    registry.sync([
      createDevice('ata-1', 'ATA', HomeDeviceType.Ata),
      createDevice('atw-1', 'ATW', HomeDeviceType.Atw),
      createDevice('ata-2', 'ATA 2', HomeDeviceType.Ata),
    ])

    expect(registry.getByType(HomeDeviceType.Ata)).toHaveLength(2)
    expect(registry.getByType(HomeDeviceType.Atw)).toHaveLength(1)
  })
})
