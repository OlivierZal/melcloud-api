import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { HomeAPIAdapter } from '../../src/api/home-types.ts'
import type { HomeBuildingFacade } from '../../src/facades/home-building.ts'
import { HomeRegistry } from '../../src/entities/home-registry.ts'
import { HomeFacadeManager } from '../../src/facades/home-manager.ts'
import { Temporal } from '../../src/temporal.ts'
import { okValue } from '../helpers.ts'
import {
  createMockHomeApi,
  homeBuildingRef,
  typedHomeAtwDeviceData,
  typedHomeDeviceData,
} from '../home-fixtures.ts'

const FROST = { active: false, enabled: true, max: 12, min: 6 }

// One window as two units hold it, each on its own wall clock: London
// is an hour behind Paris.
const PARIS_HOLIDAY = {
  active: false,
  enabled: true,
  endDate: '2026-08-05T00:00:00',
  startDate: '2026-08-01T00:00:00',
}
const LONDON_HOLIDAY = {
  active: false,
  enabled: true,
  endDate: '2026-08-04T23:00:00',
  startDate: '2026-07-31T23:00:00',
}

// A private registry per api double: these tests sync whole buildings
// and must not leak devices into the shared test registry.
const createApi = (): HomeAPIAdapter =>
  createMockHomeApi({ registry: new HomeRegistry(), timezone: 'Europe/Paris' })

const syncMixedBuilding = (
  api: HomeAPIAdapter,
  overrides: {
    ataFrost?: typeof FROST | null
    ataHoliday?: typeof PARIS_HOLIDAY | null
    atwFrost?: typeof FROST | null
    atwHoliday?: typeof PARIS_HOLIDAY | null
    atwTimeZone?: string
    overheat?: typeof FROST | null
  } = {},
): void => {
  api.registry.syncDevices([
    typedHomeDeviceData(
      {
        frostProtection: overrides.ataFrost ?? null,
        holidayMode: overrides.ataHoliday ?? null,
        id: 'ata-1',
        overheatProtection: overrides.overheat ?? null,
      },
      { building: homeBuildingRef() },
    ),
    typedHomeAtwDeviceData(
      {
        frostProtection: overrides.atwFrost ?? null,
        holidayMode: overrides.atwHoliday ?? null,
        id: 'atw-1',
        timeZone: overrides.atwTimeZone ?? 'Europe/Paris',
      },
      { building: homeBuildingRef() },
    ),
  ])
}

const buildingOf = (api: HomeAPIAdapter): HomeBuildingFacade => {
  const manager = new HomeFacadeManager(api)
  const facade = manager.getBuilding('home-building-1')
  if (facade === null) {
    throw new Error('building facade not resolved')
  }
  return facade
}

describe('home building facade — per-target settings', () => {
  it('resolves for a building whose only devices are ATW', () => {
    const api = createApi()
    api.registry.syncDevices([
      typedHomeAtwDeviceData({ id: 'atw-1' }, { building: homeBuildingRef() }),
    ])
    const facade = buildingOf(api)

    expect(facade.devices.map(({ id }) => id)).toStrictEqual(['atw-1'])
    expect(facade.supportsOverheat).toBe(false)
  })

  it('answers the all-null group state and aggregate on an empty ATA subset', async () => {
    const api = createApi()
    api.registry.syncDevices([
      typedHomeAtwDeviceData({ id: 'atw-1' }, { building: homeBuildingRef() }),
    ])
    const facade = buildingOf(api)

    expect(okValue(await facade.getGroup())).toStrictEqual({
      FanSpeed: null,
      OperationMode: null,
      Power: null,
      SetTemperature: null,
      VaneHorizontalDirection: null,
      VaneVerticalDirection: null,
    })
    // The documented empty fold: no member to agree with reads as mixed.
    expect(okValue(await facade.getOverheatProtection())).toStrictEqual({
      isEnabled: null,
      max: null,
      min: null,
    })
  })

  it('skips the frost and holiday writes once the building empties', async () => {
    const api = createApi()
    syncMixedBuilding(api)
    const facade = buildingOf(api)
    api.registry.syncDevices([])

    await facade.updateFrostProtection({ isEnabled: true, max: 12, min: 6 })
    await facade.updateHolidayMode({
      endDate: '2026-08-05T00:00:00',
      isEnabled: true,
      startDate: '2026-08-01T00:00:00',
    })

    expect(api.updateFrostProtection).not.toHaveBeenCalled()
    expect(api.updateHolidayMode).not.toHaveBeenCalled()
  })

  it('supports overheat once an ATA member exists', () => {
    const api = createApi()
    syncMixedBuilding(api)

    expect(buildingOf(api).supportsOverheat).toBe(true)
  })

  it('aggregates agreeing frost protections into the shared state', async () => {
    const api = createApi()
    syncMixedBuilding(api, { ataFrost: FROST, atwFrost: FROST })

    expect(okValue(await buildingOf(api).getFrostProtection())).toStrictEqual({
      isEnabled: true,
      max: 12,
      min: 6,
    })
  })

  it('folds a diverging or unconfigured member to null per field', async () => {
    const api = createApi()
    syncMixedBuilding(api, { ataFrost: FROST, atwFrost: null })

    expect(okValue(await buildingOf(api).getFrostProtection())).toStrictEqual({
      isEnabled: null,
      max: null,
      min: null,
    })
  })

  it("reads each member's window on that member's clock before folding", async () => {
    const api = createApi()
    syncMixedBuilding(api, {
      ataHoliday: PARIS_HOLIDAY,
      atwHoliday: LONDON_HOLIDAY,
      atwTimeZone: 'Europe/London',
    })

    // The two members hold the same instants, so the fold is that
    // window on the caller's clock and nothing reads as mixed.
    expect(okValue(await buildingOf(api).getHolidayMode())).toStrictEqual({
      endDate: '2026-08-05T00:00:00',
      isEnabled: true,
      startDate: '2026-08-01T00:00:00',
    })
  })

  it('folds two windows of the same wall clock on two clocks as mixed', async () => {
    const api = createApi()
    syncMixedBuilding(api, {
      ataHoliday: PARIS_HOLIDAY,
      atwHoliday: PARIS_HOLIDAY,
      atwTimeZone: 'Europe/London',
    })

    expect(okValue(await buildingOf(api).getHolidayMode())).toStrictEqual({
      endDate: null,
      isEnabled: true,
      startDate: null,
    })
  })

  it('reads all-disabled holiday mode from unconfigured members', async () => {
    const api = createApi()
    syncMixedBuilding(api)

    expect(okValue(await buildingOf(api).getHolidayMode())).toStrictEqual({
      endDate: null,
      isEnabled: false,
      startDate: null,
    })
  })

  it('aggregates overheat over the ATA members only', async () => {
    const api = createApi()
    syncMixedBuilding(api, { overheat: FROST })

    expect(
      okValue(await buildingOf(api).getOverheatProtection()),
    ).toStrictEqual({ isEnabled: true, max: 12, min: 6 })
  })

  it('writes frost protection for every member in one clamped batch', async () => {
    const api = createApi()
    syncMixedBuilding(api)

    await buildingOf(api).updateFrostProtection({
      isEnabled: true,
      max: 20,
      min: 2,
    })

    expect(api.updateFrostProtection).toHaveBeenCalledWith({
      enabled: true,
      max: 16,
      min: 4,
      units: { ATA: ['ata-1'], ATW: ['atw-1'] },
    })
  })

  describe('holiday window writes', () => {
    beforeEach(() => {
      vi.spyOn(Temporal.Now, 'instant').mockReturnValue(
        Temporal.Instant.from('2026-07-20T10:00:00Z'),
      )
    })

    afterEach(() => {
      vi.mocked(Temporal.Now.instant).mockRestore()
    })

    it("writes the holiday window for every member, on the members' clock", async () => {
      const api = createApi()
      syncMixedBuilding(api)

      await buildingOf(api).updateHolidayMode({
        endDate: '2026-08-05T00:00:00',
        isEnabled: true,
        startDate: '2026-08-01T00:00:00',
      })

      expect(api.updateHolidayMode).toHaveBeenCalledExactlyOnceWith({
        enabled: true,
        endDate: '2026-08-05T00:00:00',
        startDate: '2026-08-01T00:00:00',
        units: { ATA: ['ata-1'], ATW: ['atw-1'] },
      })
    })

    it('writes one window per member clock', async () => {
      const api = createApi()
      syncMixedBuilding(api, { atwTimeZone: 'Europe/London' })

      await buildingOf(api).updateHolidayMode({
        endDate: '2026-08-05T00:00:00',
        isEnabled: true,
        startDate: '2026-08-01T00:00:00',
      })

      expect(api.updateHolidayMode).toHaveBeenCalledTimes(2)
      expect(api.updateHolidayMode).toHaveBeenCalledWith({
        enabled: true,
        endDate: '2026-08-05T00:00:00',
        startDate: '2026-08-01T00:00:00',
        units: { ATA: ['ata-1'] },
      })
      expect(api.updateHolidayMode).toHaveBeenCalledWith({
        enabled: true,
        endDate: '2026-08-04T23:00:00',
        startDate: '2026-07-31T23:00:00',
        units: { ATW: ['atw-1'] },
      })
    })
  })

  it('writes overheat protection to the ATA members only', async () => {
    const api = createApi()
    syncMixedBuilding(api)

    await buildingOf(api).updateOverheatProtection({
      isEnabled: true,
      max: 37,
      min: 35,
    })

    expect(api.updateOverheatProtection).toHaveBeenCalledWith({
      enabled: true,
      max: 37,
      min: 35,
      units: { ATA: ['ata-1'] },
    })
  })

  it('skips the overheat write when the building has no ATA member', async () => {
    const api = createApi()
    api.registry.syncDevices([
      typedHomeAtwDeviceData({ id: 'atw-1' }, { building: homeBuildingRef() }),
    ])

    await buildingOf(api).updateOverheatProtection({
      isEnabled: true,
      max: 37,
      min: 35,
    })

    expect(api.updateOverheatProtection).not.toHaveBeenCalled()
  })

  it('fans the power write out to every member', async () => {
    const api = createApi()
    syncMixedBuilding(api)

    await buildingOf(api).updatePower(false)

    expect(api.updateValues).toHaveBeenCalledWith('ata-1', { power: false })
    expect(api.updateValues).toHaveBeenCalledWith('atw-1', { power: false })
  })

  it('defaults the power write to on', async () => {
    const api = createApi()
    syncMixedBuilding(api)

    await buildingOf(api).updatePower()

    expect(api.updateValues).toHaveBeenCalledWith('ata-1', { power: true })
  })

  it('surfaces a single power failure as itself', async () => {
    const api = createApi()
    syncMixedBuilding(api)
    vi.mocked(api.updateValues)
      .mockRejectedValueOnce(new Error('BFF failure'))
      .mockResolvedValueOnce()

    await expect(buildingOf(api).updatePower()).rejects.toThrow('BFF failure')
  })

  it('bundles several power failures into one AggregateError', async () => {
    const api = createApi()
    syncMixedBuilding(api)
    vi.mocked(api.updateValues).mockRejectedValue(new Error('BFF failure'))

    await expect(buildingOf(api).updatePower()).rejects.toThrow(
      'Power update failed on members',
    )
  })
})
