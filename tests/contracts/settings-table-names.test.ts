import { defined } from '@olivierzal/api-core/testing'
import { describe, expect, it, vi } from 'vitest'

import type { ClassicAPIAdapter } from '../../src/api/classic-types.ts'
import { ClassicFacadeManager } from '../../src/facades/classic-manager.ts'
import { ok } from '../../src/types/index.ts'
import {
  classicAreaData,
  classicAtaDevice,
  classicBuildingData,
  classicFloorData,
  classicFrostProtectionResponse,
  classicHolidayModeResponse,
  createMockClassicApi,
  populatedClassicRegistry,
} from '../classic-fixtures.ts'

// MELCloud names the level a settings read addresses by its own table,
// sent verbatim as `tableName`: `Building`, `Floor` and `Area` for a
// zone, `DeviceLocation` for a unit. The names are the wire's, never
// this SDK's: from 30.0.0 to 60.9.0 a rename of the Classic exports had
// prefixed the three zone names too, so every zone-level read asked
// MELCloud for a table it does not have.
describe('settings read — table names on the wire', () => {
  it.each([
    { id: 1, kind: 'buildings', tableName: 'Building' },
    { id: 10, kind: 'floors', tableName: 'Floor' },
    { id: 100, kind: 'areas', tableName: 'Area' },
    { id: 1000, kind: 'devices', tableName: 'DeviceLocation' },
  ] as const)(
    'reads the settings of one of the $kind from $tableName',
    async ({ id, kind, tableName }) => {
      const getFrostProtection = vi
        .fn<ClassicAPIAdapter['getFrostProtection']>()
        .mockResolvedValue(ok(classicFrostProtectionResponse()))
      const getHolidayMode = vi
        .fn<ClassicAPIAdapter['getHolidayMode']>()
        .mockResolvedValue(ok(classicHolidayModeResponse()))
      const registry = populatedClassicRegistry({
        areas: [classicAreaData()],
        buildings: [classicBuildingData({ FPDefined: true, HMDefined: true })],
        devices: [classicAtaDevice()],
        floors: [classicFloorData()],
      })
      const manager = new ClassicFacadeManager(
        createMockClassicApi({ getFrostProtection, getHolidayMode, registry }),
      )
      const facade = defined(manager.getById(kind, id))
      await facade.getFrostProtection()
      await facade.getHolidayMode()

      expect(getFrostProtection).toHaveBeenCalledWith({
        params: { id, tableName },
      })
      expect(getHolidayMode).toHaveBeenCalledWith({ params: { id, tableName } })
    },
  )
})
