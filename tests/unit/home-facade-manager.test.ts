import { cast, defined, mock } from '@olivierzal/api-core/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { HomeAPIAdapter } from '../../src/api/home-types.ts'
import type { HomeDevice } from '../../src/entities/home-device.ts'
import type { HomeRegistry } from '../../src/entities/home-registry.ts'
import type { HolidayModeUpdate } from '../../src/holiday-mode.ts'
import { HomeDeviceType } from '../../src/constants.ts'
import { HomeDeviceAtaFacade } from '../../src/facades/home-device-ata.ts'
import { HomeDeviceAtwFacade } from '../../src/facades/home-device-atw.ts'
import { HomeFacadeManager } from '../../src/facades/home-manager.ts'
import {
  type HomeDeviceFacadeAny,
  isHomeAtaFacade,
  isHomeAtwFacade,
} from '../../src/facades/home-types.ts'
import { Temporal } from '../../src/temporal.ts'
import { onHost } from '../helpers.ts'
import {
  createMockHomeApi,
  homeAtwDevice,
  homeDevice,
  resetHomeDevices,
} from '../home-fixtures.ts'

const createModel = (): ReturnType<typeof homeDevice> =>
  homeDevice({ id: 'device-1', name: 'Test ClassicDevice' })

describe('home facade manager', () => {
  beforeEach(resetHomeDevices)

  it('returns an ATA facade for an ATA device model', () => {
    const manager = new HomeFacadeManager(createMockHomeApi())
    const facade = manager.get(createModel())

    expect(facade).toBeInstanceOf(HomeDeviceAtaFacade)
  })

  it('returns an ATW facade for an ATW device model', () => {
    const manager = new HomeFacadeManager(createMockHomeApi())
    const facade = manager.get(homeAtwDevice({ id: 'atw-1' }))

    expect(facade).toBeInstanceOf(HomeDeviceAtwFacade)
  })

  it('caches facades for the same instance', () => {
    const manager = new HomeFacadeManager(createMockHomeApi())
    const model = createModel()

    expect(manager.get(model)).toBe(manager.get(model))
  })

  it('returns different facades for different instances', () => {
    const manager = new HomeFacadeManager(createMockHomeApi())
    const model1 = createModel()
    const model2 = homeDevice({
      id: 'device-2',
      name: 'Other ClassicDevice',
      rssi: -60,
    })

    expect(manager.get(model1)).not.toBe(manager.get(model2))
  })

  it('resolves a device facade by id and null for an unknown id', () => {
    const manager = new HomeFacadeManager(createMockHomeApi())
    const ata = homeDevice({ id: 'by-id-ata' })
    const atw = homeAtwDevice({ id: 'by-id-atw' })

    expect(manager.getById('by-id-ata')).toBe(manager.get(ata))
    expect(manager.getById('by-id-atw')).toBe(manager.get(atw))
    expect(manager.getById('missing')).toBeNull()
  })

  it('exposes the connection type and narrows via the facade guards', () => {
    const manager = new HomeFacadeManager(createMockHomeApi())
    const facades: HomeDeviceFacadeAny[] = [
      manager.get(homeDevice({ id: 'guard-ata' })),
      manager.get(homeAtwDevice({ id: 'guard-atw' })),
    ]
    const ata = defined(facades[0])
    const atw = defined(facades[1])

    expect(ata.type).toBe(HomeDeviceType.Ata)
    expect(isHomeAtaFacade(ata)).toBe(true)
    expect(isHomeAtwFacade(ata)).toBe(false)
    expect(isHomeAtwFacade(atw)).toBe(true)
  })

  it('returns null for a model of an unknown connection type', () => {
    const manager = new HomeFacadeManager(createMockHomeApi())
    const rogue = homeDevice({ id: 'rogue' })
    Object.defineProperty(rogue, 'type', { value: 'unknown' })

    expect(manager.getById('rogue')).toBeNull()
  })

  it('delegates getBuildings and getZones to the registry', () => {
    const registry = {
      getBuildings: vi.fn<HomeRegistry['getBuildings']>().mockReturnValue([]),
      getZones: vi.fn<HomeRegistry['getZones']>().mockReturnValue([]),
    }
    const manager = new HomeFacadeManager(
      createMockHomeApi({ registry: cast(registry) }),
    )

    expect(manager.getBuildings({ type: HomeDeviceType.Ata })).toStrictEqual([])
    expect(manager.getZones()).toStrictEqual([])
    expect(registry.getBuildings).toHaveBeenCalledWith({
      type: HomeDeviceType.Ata,
    })
    expect(registry.getZones).toHaveBeenCalledWith(undefined)
  })

  it('batches frost protection by device type, clamped and enabled-mapped', async () => {
    const devicesById = new Map<string, HomeDevice>([
      ['atw-1', homeAtwDevice({ id: 'atw-1' })],
      ['device-1', createModel()],
    ])
    const api = createMockHomeApi({
      registry: mock<HomeRegistry>({
        getById: vi.fn<HomeRegistry['getById']>((id) => devicesById.get(id)),
      }),
    })
    const manager = new HomeFacadeManager(api)

    await manager.updateFrostProtection(['device-1', 'atw-1', 'unknown'], {
      isEnabled: true,
      max: 20,
      min: 2,
    })

    // Clamped (2 -> 4, 20 -> 16), enabled mapped, ids split by type,
    // unknown id dropped.
    expect(api.updateFrostProtection).toHaveBeenCalledWith({
      enabled: true,
      max: 16,
      min: 4,
      units: { ATA: ['device-1'], ATW: ['atw-1'] },
    })
  })

  it('batches overheat protection to the ATA ids only, clamped', async () => {
    const devicesById = new Map<string, HomeDevice>([
      ['atw-1', homeAtwDevice({ id: 'atw-1' })],
      ['device-1', createModel()],
    ])
    const api = createMockHomeApi({
      registry: mock<HomeRegistry>({
        getById: vi.fn<HomeRegistry['getById']>((id) => devicesById.get(id)),
      }),
    })
    const manager = new HomeFacadeManager(api)

    await manager.updateOverheatProtection(['device-1', 'atw-1', 'unknown'], {
      isEnabled: true,
      max: 45,
      min: 20,
    })

    // Clamped (20 -> 31, 45 -> 40); the ATW and unknown ids are dropped —
    // the feature is ATA-only.
    expect(api.updateOverheatProtection).toHaveBeenCalledWith({
      enabled: true,
      max: 40,
      min: 31,
      units: { ATA: ['device-1'] },
    })
  })

  it('skips the overheat write when no ATA id remains', async () => {
    const api = createMockHomeApi({
      registry: mock<HomeRegistry>({
        getById: vi.fn<HomeRegistry['getById']>(() =>
          homeAtwDevice({ id: 'atw-1' }),
        ),
      }),
    })
    const manager = new HomeFacadeManager(api)

    await manager.updateOverheatProtection(['atw-1'], {
      isEnabled: true,
      max: 37,
      min: 35,
    })

    expect(api.updateOverheatProtection).not.toHaveBeenCalled()
  })

  it('batches holiday mode by device type', async () => {
    const api = createMockHomeApi({
      registry: mock<HomeRegistry>({
        getById: vi.fn<HomeRegistry['getById']>(() => createModel()),
      }),
    })
    const manager = new HomeFacadeManager(api)

    await manager.updateHolidayMode(['device-1'], {
      endDate: '2026-08-05T00:00:00',
      isEnabled: false,
      startDate: '2026-08-01T00:00:00',
    })

    // A disabled window's dates are ignored by the wire and pass
    // through unprojected — no conversion may fail a disable.
    expect(api.updateHolidayMode).toHaveBeenCalledWith({
      enabled: false,
      endDate: '2026-08-05T00:00:00',
      startDate: '2026-08-01T00:00:00',
      units: { ATA: ['device-1'] },
    })
  })
})

// One holiday write through the manager's batch, the entry point whose
// ids can sit on several clocks.
const writeHolidayMode = async (
  api: HomeAPIAdapter,
  deviceIds: readonly string[],
  update: HolidayModeUpdate,
): Promise<void> => {
  const manager = new HomeFacadeManager(api)
  await manager.updateHolidayMode(deviceIds, update)
}

// What the Home wire does with a holiday window was live-probed on
// 2026-11-21, by writes on one unit (CLAUDE.md has the measures): it
// reads the zoneless bounds on the UNIT's wall clock, arms the window
// at its start, closes it at its end, and takes no window that has
// already begun. Every clause below is one of those facts, or what
// keeps the SDK from sending the wire a window it would store without
// arming.
describe('holiday-mode write projection', () => {
  // 17:00 in Paris, 16:00 in London and 11:00 in New York.
  const NOW = Temporal.Instant.from('2026-11-21T16:00:00Z')
  const WEEK = {
    endDate: '2026-12-01T08:00',
    isEnabled: true,
    startDate: '2026-11-24T08:00',
  }

  beforeEach(() => {
    resetHomeDevices()
    vi.spyOn(Temporal.Now, 'instant').mockReturnValue(NOW)
  })

  afterEach(() => {
    vi.mocked(Temporal.Now.instant).mockRestore()
  })

  // 08:00 in Paris, the caller's clock: 02:00 in New York, six hours
  // behind, and the bounds as given where the unit shares that clock.
  it.each([
    {
      endDate: '2026-12-01T02:00:00',
      label: 'another clock than the caller',
      startDate: '2026-11-24T02:00:00',
      timeZone: 'America/New_York',
    },
    {
      endDate: '2026-12-01T08:00:00',
      label: "the caller's own clock",
      startDate: '2026-11-24T08:00:00',
      timeZone: 'Europe/Paris',
    },
  ])(
    "writes an enabled window on the unit's clock, for a unit on $label",
    async ({ endDate, startDate, timeZone }) => {
      homeDevice({ id: 'device-1', timeZone })
      const api = createMockHomeApi({ timezone: 'Europe/Paris' })

      await writeHolidayMode(api, ['device-1'], WEEK)

      expect(api.updateHolidayMode).toHaveBeenCalledExactlyOnceWith({
        enabled: true,
        endDate,
        startDate,
        units: { ATA: ['device-1'] },
      })
    },
  )

  // The host sits in Tokyo, which is never on UTC: a fallback to UTC,
  // the assumption this write once made of the wire, has to change the
  // result (a host in London would not tell the two apart in winter).
  it("reads the caller's clock off the host when the API names none", async () => {
    homeDevice({ id: 'device-1', timeZone: 'America/New_York' })
    const api = createMockHomeApi()

    await onHost('Asia/Tokyo', async () =>
      writeHolidayMode(api, ['device-1'], WEEK),
    )

    // 08:00 in Tokyo is 18:00 the day before in New York, fourteen
    // hours behind.
    expect(api.updateHolidayMode).toHaveBeenCalledExactlyOnceWith({
      enabled: true,
      endDate: '2026-11-30T18:00:00',
      startDate: '2026-11-23T18:00:00',
      units: { ATA: ['device-1'] },
    })
  })

  it('sends one window per unit clock, each with the units on it', async () => {
    homeDevice({ id: 'paris-ata', timeZone: 'Europe/Paris' })
    homeDevice({ id: 'london-ata', timeZone: 'Europe/London' })
    homeAtwDevice({ id: 'paris-atw', timeZone: 'Europe/Paris' })
    const api = createMockHomeApi({ timezone: 'Europe/Paris' })

    await writeHolidayMode(api, ['paris-ata', 'london-ata', 'paris-atw'], WEEK)

    expect(api.updateHolidayMode).toHaveBeenCalledTimes(2)
    expect(api.updateHolidayMode).toHaveBeenCalledWith({
      enabled: true,
      endDate: '2026-12-01T08:00:00',
      startDate: '2026-11-24T08:00:00',
      units: { ATA: ['paris-ata'], ATW: ['paris-atw'] },
    })
    expect(api.updateHolidayMode).toHaveBeenCalledWith({
      enabled: true,
      endDate: '2026-12-01T07:00:00',
      startDate: '2026-11-24T07:00:00',
      units: { ATA: ['london-ata'] },
    })
  })

  it('surfaces a single failed write as itself, the other clock written all the same', async () => {
    homeDevice({ id: 'paris-ata', timeZone: 'Europe/Paris' })
    homeDevice({ id: 'london-ata', timeZone: 'Europe/London' })
    const refusal = new Error('refused')
    const updateHolidayMode = vi
      .fn<HomeAPIAdapter['updateHolidayMode']>()
      .mockRejectedValueOnce(refusal)
      .mockResolvedValueOnce()
    const api = createMockHomeApi({
      timezone: 'Europe/Paris',
      updateHolidayMode,
    })

    await expect(
      writeHolidayMode(api, ['paris-ata', 'london-ata'], WEEK),
    ).rejects.toBe(refusal)
    expect(updateHolidayMode).toHaveBeenCalledTimes(2)
  })

  it("bundles the failures when several clocks' writes fail", async () => {
    homeDevice({ id: 'paris-ata', timeZone: 'Europe/Paris' })
    homeDevice({ id: 'london-ata', timeZone: 'Europe/London' })
    const failures = [new Error('refused in Paris'), new Error('lost')]
    const updateHolidayMode = vi
      .fn<HomeAPIAdapter['updateHolidayMode']>()
      .mockRejectedValueOnce(failures[0])
      .mockRejectedValueOnce(failures[1])
    const api = createMockHomeApi({
      timezone: 'Europe/Paris',
      updateHolidayMode,
    })

    await expect(
      writeHolidayMode(api, ['paris-ata', 'london-ata'], WEEK),
    ).rejects.toMatchObject({
      errors: failures,
      message: 'Holiday mode update failed on unit clocks',
      name: 'AggregateError',
    })
  })

  // The wire arms a window at its start and takes none that has begun:
  // "from now" goes out a minute ahead, as does any start closer than
  // that, a request needing its time to arrive.
  it.each([
    { label: 'already past', startDate: '2026-11-21T09:00' },
    { label: 'now', startDate: '2026-11-21T17:00:00' },
    { label: 'half a minute ahead', startDate: '2026-11-21T17:00:30' },
  ])(
    'starts a window whose start is $label a minute from now',
    async ({ startDate }) => {
      homeDevice({ id: 'device-1', timeZone: 'Europe/Paris' })
      const api = createMockHomeApi({ timezone: 'Europe/Paris' })

      await writeHolidayMode(api, ['device-1'], {
        endDate: '2026-11-28T08:00',
        isEnabled: true,
        startDate,
      })

      expect(api.updateHolidayMode).toHaveBeenCalledExactlyOnceWith({
        enabled: true,
        endDate: '2026-11-28T08:00:00',
        startDate: '2026-11-21T17:01:00',
        units: { ATA: ['device-1'] },
      })
    },
  )

  it('leaves alone a start more than a minute ahead, to the second', async () => {
    homeDevice({ id: 'device-1', timeZone: 'Europe/Paris' })
    const api = createMockHomeApi({ timezone: 'Europe/Paris' })

    await writeHolidayMode(api, ['device-1'], {
      endDate: '2026-11-28T08:00',
      isEnabled: true,
      startDate: '2026-11-21T17:01:01.75',
    })

    expect(api.updateHolidayMode).toHaveBeenCalledExactlyOnceWith({
      enabled: true,
      endDate: '2026-11-28T08:00:00',
      startDate: '2026-11-21T17:01:01',
      units: { ATA: ['device-1'] },
    })
  })

  // The wire stores a window that ends before it starts without a word
  // (a 200, the window enabled), so the refusal has to come from here,
  // and it is judged on what the wire receives: the bounds on the
  // unit's clock, to the second.
  it.each([
    {
      endDate: '2026-11-30T08:00',
      label: 'is given backwards',
      startDate: '2026-12-01T08:00',
    },
    {
      endDate: '2026-11-21T17:00:30',
      label: 'is over within the minute',
      startDate: '2026-11-21T17:00:00',
    },
    {
      endDate: '2026-11-21T17:01:00',
      label: 'would end the second it starts',
      startDate: '2026-11-21T17:00:00',
    },
    {
      endDate: '2026-11-21T17:01:00.5',
      label: 'would start and end within one second of the wire',
      startDate: '2026-11-21T17:00:00',
    },
    {
      endDate: '2026-11-20T08:00',
      label: 'is already over',
      startDate: '2026-11-14T08:00',
    },
  ])(
    'refuses, before any request, a window that $label',
    async ({ endDate, startDate }) => {
      homeDevice({ id: 'device-1', timeZone: 'Europe/Paris' })
      const api = createMockHomeApi({ timezone: 'Europe/Paris' })

      await expect(
        writeHolidayMode(api, ['device-1'], {
          endDate,
          isEnabled: true,
          startDate,
        }),
      ).rejects.toThrow(
        new RangeError('The holiday-mode window ends before it can start'),
      )
      expect(api.updateHolidayMode).not.toHaveBeenCalled()
    },
  )

  // Paris puts its clocks back on 2027-10-31 at 01:00 UTC: 00:50 UTC is
  // 02:50 there and 01:10 UTC is 02:10, an hour the clock runs twice. A
  // caller on another clock asks twenty minutes in order, and the
  // zoneless bounds the wire would get read backwards.
  it("refuses a window whose bounds read backwards on the unit's clock", async () => {
    homeDevice({ id: 'device-1', timeZone: 'Europe/Paris' })
    const api = createMockHomeApi({ timezone: 'UTC' })

    await expect(
      writeHolidayMode(api, ['device-1'], {
        endDate: '2027-10-31T01:10',
        isEnabled: true,
        startDate: '2027-10-31T00:50',
      }),
    ).rejects.toThrow(
      new RangeError('The holiday-mode window ends before it can start'),
    )
    expect(api.updateHolidayMode).not.toHaveBeenCalled()
  })

  it('refuses a malformed bound before any request', async () => {
    homeDevice({ id: 'device-1', timeZone: 'Europe/Paris' })
    const api = createMockHomeApi({ timezone: 'Europe/Paris' })

    await expect(
      writeHolidayMode(api, ['device-1'], { ...WEEK, endDate: 'not-a-date' }),
    ).rejects.toThrow(RangeError)
    expect(api.updateHolidayMode).not.toHaveBeenCalled()
  })

  // Every clock's write is built before the first goes out: the unit
  // whose clock cannot be read must not leave the other one written.
  it('writes no clock at all when one unit names a timezone the runtime does not know', async () => {
    homeDevice({ id: 'paris-ata', timeZone: 'Europe/Paris' })
    homeDevice({ id: 'odd-ata', timeZone: 'Romance Standard Time' })
    const api = createMockHomeApi({ timezone: 'Europe/Paris' })

    await expect(
      writeHolidayMode(api, ['paris-ata', 'odd-ata'], WEEK),
    ).rejects.toThrow(RangeError)
    expect(api.updateHolidayMode).not.toHaveBeenCalled()
  })
})
