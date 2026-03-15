import { describe, expect, it } from 'vitest'

import { DeviceType } from '../../src/constants.ts'
import { FacadeManager } from '../../src/facades/manager.ts'
import { ModelRegistry } from '../../src/models/index.ts'
import { areaData, ataDevice, buildingData, floorData } from '../fixtures.ts'
import { createMockApi, mock } from '../helpers.ts'

const createManagerWithRegistry = (): {
  manager: FacadeManager
  registry: ModelRegistry
} => {
  const registry = new ModelRegistry()
  registry.syncBuildings([buildingData()])
  registry.syncFloors([floorData()])
  registry.syncAreas([areaData()])
  registry.syncDevices([ataDevice()])
  const manager = new FacadeManager(createMockApi(), registry)
  return { manager, registry }
}

describe('facadeManager', () => {
  it('returns null when no instance is provided', () => {
    const registry = new ModelRegistry()
    const manager = new FacadeManager(mock<object>(), registry)

    expect(manager.get()).toBeNull()
  })

  it('returns a facade for a building instance', () => {
    const { manager, registry } = createManagerWithRegistry()
    const building = registry.buildings.getById(1)!

    expect(manager.get(building)).not.toBeNull()
    expect(manager.get(building).id).toBe(1)
    expect(manager.get(building).name).toBe('Building')
  })

  it('returns a facade for a floor instance', () => {
    const { manager, registry } = createManagerWithRegistry()
    const facade = manager.get(registry.floors.getById(10)!)

    expect(facade).not.toBeNull()
    expect(facade.id).toBe(10)
  })

  it('returns a facade for an area instance', () => {
    const { manager, registry } = createManagerWithRegistry()
    const facade = manager.get(registry.areas.getById(100)!)

    expect(facade).not.toBeNull()
    expect(facade.id).toBe(100)
  })

  it('returns a facade for a device instance', () => {
    const { manager, registry } = createManagerWithRegistry()
    const facade = manager.get(registry.devices.getById(1000)!)

    expect(facade).not.toBeNull()
    expect(facade.id).toBe(1000)
  })

  it('caches facades for the same instance', () => {
    const { manager, registry } = createManagerWithRegistry()
    const building = registry.buildings.getById(1)!

    expect(manager.get(building)).toBe(manager.get(building))
  })

  it('returns buildings via getBuildings', () => {
    const { manager } = createManagerWithRegistry()
    const buildings = manager.getBuildings()

    expect(buildings).toHaveLength(1)
    expect(buildings[0]!.name).toBe('Building')
  })

  it('filters buildings by device type via getBuildings', () => {
    const { manager } = createManagerWithRegistry()

    expect(manager.getBuildings({ type: DeviceType.Ata })).toHaveLength(1)
    expect(manager.getBuildings({ type: DeviceType.Atw })).toHaveLength(0)
  })

  it('returns zones via getZones', () => {
    const { manager } = createManagerWithRegistry()

    expect(manager.getZones().length).toBeGreaterThan(0)
  })

  it('filters zones by device type via getZones', () => {
    const { manager } = createManagerWithRegistry()

    expect(manager.getZones({ type: DeviceType.Ata }).length).toBeGreaterThan(0)
    expect(manager.getZones({ type: DeviceType.Atw })).toHaveLength(0)
  })
})
