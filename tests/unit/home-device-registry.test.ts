import { describe, expect, it } from 'vitest'

import type { HomeDevice } from '../../src/types/index.ts'
import { DeviceType } from '../../src/constants.ts'
import {
  type TypedHomeDevice,
  HomeDeviceRegistry,
} from '../../src/services/home-device-registry.ts'
import { mock } from '../helpers.ts'

const createDevice = (
  id: string,
  name = 'Device',
  type: DeviceType = DeviceType.Ata,
): TypedHomeDevice => ({
  device: mock<HomeDevice>({ givenDisplayName: name, id, settings: [] }),
  type,
})

describe('home device registry', () => {
  it('should sync new devices', () => {
    const registry = new HomeDeviceRegistry()
    registry.sync([createDevice('a'), createDevice('b')])

    expect(registry.getAll()).toHaveLength(2)
    expect(registry.getById('a')?.name).toBe('Device')
  })

  it('should update existing devices in place', () => {
    const registry = new HomeDeviceRegistry()
    registry.sync([createDevice('a', 'Old')])
    const model = registry.getById('a')
    registry.sync([createDevice('a', 'New')])

    expect(registry.getById('a')).toBe(model)
    expect(model?.name).toBe('New')
  })

  it('should prune stale devices', () => {
    const registry = new HomeDeviceRegistry()
    registry.sync([createDevice('a'), createDevice('b')])
    registry.sync([createDevice('a')])

    expect(registry.getAll()).toHaveLength(1)
    expect(registry.getById('b')).toBeUndefined()
  })

  it('should filter by device type', () => {
    const registry = new HomeDeviceRegistry()
    registry.sync([
      createDevice('ata-1', 'ATA', DeviceType.Ata),
      createDevice('atw-1', 'ATW', DeviceType.Atw),
      createDevice('ata-2', 'ATA 2', DeviceType.Ata),
    ])

    expect(registry.getByType(DeviceType.Ata)).toHaveLength(2)
    expect(registry.getByType(DeviceType.Atw)).toHaveLength(1)
    expect(registry.getByType(DeviceType.Erv)).toHaveLength(0)
  })
})
