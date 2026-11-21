import { defined } from '@olivierzal/api-core/testing'
import { type Mock, describe, expect, it, vi } from 'vitest'

import type { ClassicAPIAdapter } from '../../src/api/classic-types.ts'
import type { HomeAPIAdapter } from '../../src/api/home-types.ts'
import type { HolidayModeUpdate } from '../../src/holiday-mode.ts'
import { ClassicBuildingFacade } from '../../src/facades/classic-building.ts'
import { HomeFacadeManager } from '../../src/facades/home-manager.ts'
import {
  classicAtaDevice,
  classicBuildingData,
  createMockClassicApi,
  populatedClassicRegistry,
} from '../classic-fixtures.ts'
import {
  createMockHomeApi,
  homeDevice,
  resetHomeDevices,
} from '../home-fixtures.ts'

// One write per dialect, through the facade a host reaches it by: a
// Classic building, a Home manager over one unit, each with the wire
// call it ends on. The caller's clock is Paris on both.
const writeOnClassic = async (
  update: HolidayModeUpdate,
): Promise<Mock<ClassicAPIAdapter['updateHolidayMode']>> => {
  const registry = populatedClassicRegistry({
    buildings: [classicBuildingData()],
    devices: [classicAtaDevice()],
  })
  const updateHolidayMode = vi
    .fn<ClassicAPIAdapter['updateHolidayMode']>()
    .mockResolvedValue({ AttributeErrors: null, Success: true })
  const facade = new ClassicBuildingFacade(
    createMockClassicApi({
      registry,
      timezone: 'Europe/Paris',
      updateHolidayMode,
    }),
    defined(registry.buildings.getById(1)),
  )
  await facade.updateHolidayMode(update)
  return updateHolidayMode
}

const writeOnHome = async (
  update: HolidayModeUpdate,
  timeZone: string,
): Promise<Mock<HomeAPIAdapter['updateHolidayMode']>> => {
  resetHomeDevices()
  // Registers the unit into the shared test registry, which is how the
  // manager resolves the ATA/ATW unit buckets and the unit's clock.
  homeDevice({ id: 'device-1', timeZone })
  const updateHolidayMode = vi
    .fn<HomeAPIAdapter['updateHolidayMode']>()
    .mockResolvedValue()
  const manager = new HomeFacadeManager(
    createMockHomeApi({ timezone: 'Europe/Paris', updateHolidayMode }),
  )
  await manager.updateHolidayMode(['device-1'], update)
  return updateHolidayMode
}

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
    const updateHolidayMode = await writeOnClassic(DISABLE)
    const call = defined(updateHolidayMode.mock.lastCall?.[0])

    expect(call.postData.Enabled).toBe(false)
    expect(call.postData.StartDate).toBeNull()
    expect(call.postData.EndDate).toBeNull()
  })

  it('home forwards the window untouched without projecting it', async () => {
    const updateHolidayMode = await writeOnHome(DISABLE, 'Europe/Paris')

    expect(updateHolidayMode).toHaveBeenCalledExactlyOnceWith({
      enabled: false,
      endDate: 'not-a-parsable-date',
      startDate: 'not-a-parsable-date',
      units: { ATA: ['device-1'] },
    })
  })
})

// The enabled twin: ONE window, the same instants on each wire's own
// clock. Classic stores UTC wall clock; Home reads a window on its
// unit's wall clock (live-probed 2026-11-21: a window written there
// arms at its start, one written in UTC is taken for an hour past and
// refused). The two clauses sit side by side because 49.0.0 gave both
// wires the projection of one, the other unmeasured. The window is of
// the far future, so nothing here depends on the day the suite runs.
describe('holidayMode write — enabled window', () => {
  // Paris summer wall clock (UTC+2), London an hour behind.
  const WINDOW = {
    endDate: '2099-08-05T00:00',
    isEnabled: true,
    startDate: '2099-08-01T00:00',
  }

  it('classic sends the window as UTC wall clock', async () => {
    const updateHolidayMode = await writeOnClassic(WINDOW)
    const call = defined(updateHolidayMode.mock.lastCall?.[0])

    expect(call.postData.StartDate).toStrictEqual({
      Day: 31,
      Hour: 22,
      Minute: 0,
      Month: 7,
      Second: 0,
      Year: 2099,
    })
    expect(call.postData.EndDate).toStrictEqual({
      Day: 4,
      Hour: 22,
      Minute: 0,
      Month: 8,
      Second: 0,
      Year: 2099,
    })
  })

  it("home sends the window on the unit's wall clock", async () => {
    const updateHolidayMode = await writeOnHome(WINDOW, 'Europe/London')

    expect(updateHolidayMode).toHaveBeenCalledExactlyOnceWith({
      enabled: true,
      endDate: '2099-08-04T23:00:00',
      startDate: '2099-07-31T23:00:00',
      units: { ATA: ['device-1'] },
    })
  })
})
