import { describe, expect, it } from 'vitest'

import type { APIAdapter } from '../../src/services/index.ts'

import { DeviceType } from '../../src/constants.ts'
import { FacadeManager } from '../../src/facades/manager.ts'
import { ModelRegistry } from '../../src/models/index.ts'
import { areaData, ataDevice, buildingData, floorData } from '../fixtures.ts'
import { mock } from '../helpers.ts'

const createPopulatedRegistry = (): ModelRegistry => {
  const registry = new ModelRegistry()
  registry.syncBuildings([buildingData()])
  registry.syncFloors([floorData()])
  registry.syncAreas([areaData()])
  registry.syncDevices([ataDevice()])
  return registry
}

describe('facadeManager', () => {
  it('returns null when no instance is provided', () => {
    const registry = new ModelRegistry()
    const manager = new FacadeManager(mock<APIAdapter>(), registry)

    expect(manager.get()).toBeNull()
  })

  it('returns a facade for a building instance', () => {
    const registry = createPopulatedRegistry()
    const manager = new FacadeManager(mock<APIAdapter>(), registry)
    const building = registry.buildings.getById(1)!
    const facade = manager.get(building)

    expect(facade).not.toBeNull()
    expect(facade.id).toBe(1)
    expect(facade.name).toBe('Building')
  })

  it('returns a facade for a floor instance', () => {
    const registry = createPopulatedRegistry()
    const manager = new FacadeManager(mock<APIAdapter>(), registry)
    const floor = registry.floors.getById(10)!
    const facade = manager.get(floor)

    expect(facade).not.toBeNull()
    expect(facade.id).toBe(10)
  })

  it('returns a facade for an area instance', () => {
    const registry = createPopulatedRegistry()
    const manager = new FacadeManager(mock<APIAdapter>(), registry)
    const area = registry.areas.getById(100)!
    const facade = manager.get(area)

    expect(facade).not.toBeNull()
    expect(facade.id).toBe(100)
  })

  it('returns a facade for a device instance', () => {
    const registry = createPopulatedRegistry()
    const manager = new FacadeManager(mock<APIAdapter>(), registry)
    const device = registry.devices.getById(1000)!
    const facade = manager.get(device)

    expect(facade).not.toBeNull()
    expect(facade.id).toBe(1000)
  })

  it('caches facades for the same instance', () => {
    const registry = createPopulatedRegistry()
    const manager = new FacadeManager(mock<APIAdapter>(), registry)
    const building = registry.buildings.getById(1)!
    const facade1 = manager.get(building)
    const facade2 = manager.get(building)

    expect(facade1).toBe(facade2)
  })

  it('returns buildings via getBuildings', () => {
    const registry = createPopulatedRegistry()
    const manager = new FacadeManager(mock<APIAdapter>(), registry)
    const buildings = manager.getBuildings()

    expect(buildings).toHaveLength(1)
    expect(buildings[0]!.name).toBe('Building')
  })

  it('filters buildings by device type via getBuildings', () => {
    const registry = createPopulatedRegistry()
    const manager = new FacadeManager(mock<APIAdapter>(), registry)

    expect(manager.getBuildings({ type: DeviceType.Ata })).toHaveLength(1)
    expect(manager.getBuildings({ type: DeviceType.Atw })).toHaveLength(0)
  })

  it('returns zones via getZones', () => {
    const registry = createPopulatedRegistry()
    const manager = new FacadeManager(mock<APIAdapter>(), registry)
    const zones = manager.getZones()

    expect(zones.length).toBeGreaterThan(0)
  })

  it('filters zones by device type via getZones', () => {
    const registry = createPopulatedRegistry()
    const manager = new FacadeManager(mock<APIAdapter>(), registry)

    expect(manager.getZones({ type: DeviceType.Ata }).length).toBeGreaterThan(0)
    expect(manager.getZones({ type: DeviceType.Atw })).toHaveLength(0)
  })
})
