import { defined } from '@olivierzal/api-core/testing'
import { describe, expect, it, vi } from 'vitest'

import type { ClassicAPIAdapter } from '../../src/api/classic-types.ts'
import { HomeRegistry } from '../../src/entities/home-registry.ts'
import { ClassicBuildingFacade } from '../../src/facades/classic-building.ts'
import { HomeFacadeManager } from '../../src/facades/home-manager.ts'
import { combineSettingsTargets } from '../../src/facades/settings-union.ts'
import { ok } from '../../src/types/index.ts'
import {
  classicAtaDevice,
  classicBuildingData,
  classicFrostProtectionResponse,
  createMockClassicApi,
  populatedClassicRegistry,
} from '../classic-fixtures.ts'
import { matchObject } from '../helpers.ts'
import {
  createMockHomeApi,
  homeBuildingRef,
  typedHomeDeviceData,
} from '../home-fixtures.ts'

// The combination's own suite judges it on scripted targets. This one
// hands it the two facades a host joins, as they are: one house, its
// Classic building and its Home building, each read and written through
// its own dialect. Every facade type answering the contract is the
// compiler's to hold; that the two wires are both reached is held here.
describe('combineSettingsTargets — a Classic building and a Home building', () => {
  it('reads the two accounts as one fold and writes them both', async () => {
    const registry = populatedClassicRegistry({
      buildings: [classicBuildingData({ FPDefined: true })],
      devices: [classicAtaDevice()],
    })
    const classicApi = createMockClassicApi({
      getFrostProtection: vi
        .fn<ClassicAPIAdapter['getFrostProtection']>()
        .mockResolvedValue(
          ok(
            classicFrostProtectionResponse({
              FPDefined: true,
              FPEnabled: true,
              FPMaxTemperature: 14,
              FPMinTemperature: 10,
            }),
          ),
        ),
      registry,
      updateFrostProtection: vi
        .fn<ClassicAPIAdapter['updateFrostProtection']>()
        .mockResolvedValue({ AttributeErrors: null, Success: true }),
    })
    const homeApi = createMockHomeApi({ registry: new HomeRegistry() })
    homeApi.registry.syncDevices([
      typedHomeDeviceData(
        {
          frostProtection: { active: false, enabled: true, max: 16, min: 10 },
          id: 'ata-1',
        },
        { building: homeBuildingRef() },
      ),
    ])
    const homeManager = new HomeFacadeManager(homeApi)
    const house = combineSettingsTargets([
      new ClassicBuildingFacade(
        classicApi,
        defined(registry.buildings.getById(1)),
      ),
      defined(homeManager.getBuilding('home-building-1')),
    ])

    // Both on, the same floor, two ceilings: the ceiling reads mixed.
    await expect(house.getFrostProtection()).resolves.toStrictEqual(
      ok({ isEnabled: true, max: null, min: 10 }),
    )

    await house.updateFrostProtection({ isEnabled: true, max: 12, min: 8 })

    expect(classicApi.updateFrostProtection).toHaveBeenCalledExactlyOnceWith({
      postData: matchObject({
        Enabled: true,
        MaximumTemperature: 12,
        MinimumTemperature: 8,
      }),
    })
    expect(homeApi.updateFrostProtection).toHaveBeenCalledExactlyOnceWith({
      enabled: true,
      max: 12,
      min: 8,
      units: { ATA: ['ata-1'] },
    })
  })
})
