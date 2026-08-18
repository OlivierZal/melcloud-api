import { describe, expect, it, vi } from 'vitest'

import type { ClassicAPIAdapter } from '../../src/api/classic-types.ts'
import type { HomeAPIAdapter } from '../../src/api/home-types.ts'
import { ClassicBuildingFacade } from '../../src/facades/classic-building.ts'
import { HomeFacadeManager } from '../../src/facades/home-manager.ts'
import {
  classicAtaDevice,
  classicBuildingData,
  createMockClassicApi,
  populatedClassicRegistry,
} from '../classic-fixtures.ts'
import { defined } from '../helpers.ts'
import { createMockHomeApi, homeDevice } from '../home-fixtures.ts'

// The write-side twin of the holiday-mode read contract: a DISABLED
// window's dates are ignored by both wires, so neither dialect may
// project them — a malformed leftover date must not fail a disable.
// The wire spelling of "ignored" legitimately differs (Classic clears
// the bounds to null components, Home forwards the strings untouched);
// what the contract pins is that NO projection runs on either.
describe('holidayMode write — disabled window', () => {
  const DISABLE = {
    endDate: 'not-a-parsable-date',
    isEnabled: false,
    startDate: 'not-a-parsable-date',
  }

  it('classic clears the bounds without projecting them', async () => {
    const registry = populatedClassicRegistry({
      buildings: [classicBuildingData()],
      devices: [classicAtaDevice()],
    })
    const updateHolidayMode = vi
      .fn<ClassicAPIAdapter['updateHolidayMode']>()
      .mockResolvedValue({ AttributeErrors: null, Success: true })
    const api = createMockClassicApi({
      timezone: 'Europe/Paris',
      updateHolidayMode,
    })
    const facade = new ClassicBuildingFacade(
      api,
      registry,
      defined(registry.buildings.getById(1)),
    )

    await facade.updateHolidayMode(DISABLE)

    const call = defined(updateHolidayMode.mock.lastCall?.[0])

    expect(call.postData.Enabled).toBe(false)
    expect(call.postData.StartDate).toBeNull()
    expect(call.postData.EndDate).toBeNull()
  })

  it('home forwards the window untouched without projecting it', async () => {
    // Registers the device into the shared test registry, which is how
    // the manager resolves the ATA/ATW unit buckets.
    homeDevice({ id: 'device-1' })
    const updateHolidayMode = vi
      .fn<HomeAPIAdapter['updateHolidayMode']>()
      .mockResolvedValue()
    const manager = new HomeFacadeManager(
      createMockHomeApi({ timezone: 'Europe/Paris', updateHolidayMode }),
    )

    await manager.updateHolidayMode(['device-1'], DISABLE)

    expect(updateHolidayMode).toHaveBeenCalledWith({
      enabled: false,
      endDate: 'not-a-parsable-date',
      startDate: 'not-a-parsable-date',
      units: { ATA: ['device-1'] },
    })
  })
})
