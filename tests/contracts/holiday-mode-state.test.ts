import { defined } from '@olivierzal/api-core/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ClassicAPIAdapter } from '../../src/api/classic-types.ts'
import type { HomeAPIAdapter } from '../../src/api/home-types.ts'
import type { HolidayModeState } from '../../src/holiday-mode.ts'
import { ClassicBuildingFacade } from '../../src/facades/classic-building.ts'
import { HomeDeviceAtaFacade } from '../../src/facades/home-device-ata.ts'
import { HomeDeviceAtwFacade } from '../../src/facades/home-device-atw.ts'
import { Temporal } from '../../src/temporal.ts'
import { err, ok } from '../../src/types/index.ts'
import {
  classicAtaDevice,
  classicBuildingData,
  classicHolidayModeResponse,
  createMockClassicApi,
  populatedClassicRegistry,
} from '../classic-fixtures.ts'
import { okValue } from '../helpers.ts'
import {
  createMockHomeApi,
  homeAtwDevice,
  homeDevice,
  resetHomeDevices,
} from '../home-fixtures.ts'

/**
 * A window both dialects can carry: the wire's date fields are never null.
 */
interface BoundedWindow extends HolidayModeState {
  readonly endDate: string
  readonly startDate: string
}

// The contract speaks the caller's clock (`api.timezone`, pinned here so
// no host zone can leak in); each wire has a clock of its own. Classic
// stores UTC wall clock. Home reads a window on its UNIT's wall clock
// (live-probed, 2026-11-21), and the units below sit in a zone that is
// neither the caller's nor UTC, so a read on either of those two has to
// change the result.
const CONTRACT_TIMEZONE = 'Europe/Paris'
const HOME_UNIT_TIMEZONE = 'America/New_York'

// The neutral holiday state is the same contract on both dialects, so
// the clauses live here once and every implementation answers them.
// Each case is ONE window said three ways: the state is its instants on
// the caller's clock, `classicWire` the same instants in UTC,
// `homeWire` the same again on the unit's clock. The enabled window
// opens in the weeks New York has changed its clocks and Paris has not
// (five hours apart instead of six) and closes after both have, and
// its Paris bounds sit on either side of that switch too (+1, then
// +2): a projection that hardcodes any one offset has to change the
// result. Start and end stay far apart and ordered, so a swap has to
// as well.
interface WindowCase {
  readonly classicWire: BoundedWindow | null
  readonly homeWire: BoundedWindow | null
  readonly label: string
  readonly state: BoundedWindow | null
}

const ENABLED_WINDOW = {
  classicWire: {
    endDate: '2026-04-10T18:30:00',
    isEnabled: true,
    startDate: '2026-03-15T08:15:00',
  },
  homeWire: {
    endDate: '2026-04-10T14:30:00',
    isEnabled: true,
    startDate: '2026-03-15T04:15:00',
  },
  label: 'an enabled window straddling both clock changes',
  state: {
    endDate: '2026-04-10T20:30:00',
    isEnabled: true,
    startDate: '2026-03-15T09:15:00',
  },
} satisfies WindowCase

// Every window of this file lies ahead of this instant, so each reads
// as its wire holds it; the clauses about a window's end move the clock
// themselves. The enabled window ends at one instant on its three
// clocks: 18:30 UTC, 14:30 in New York, 20:30 in Paris.
const BEFORE_EVERY_WINDOW = '2026-03-01T00:00:00Z'
const ENABLED_WINDOW_END = '2026-04-10T18:30:00Z'

const stopClockAt = (instant: string): void => {
  vi.spyOn(Temporal.Now, 'instant').mockReturnValue(
    Temporal.Instant.from(instant),
  )
}

const restartClock = (): void => {
  vi.mocked(Temporal.Now.instant).mockRestore()
}

const CASES: readonly WindowCase[] = [
  ENABLED_WINDOW,
  {
    classicWire: {
      endDate: '2026-11-20T21:45:00',
      isEnabled: false,
      startDate: '2026-07-05T06:20:00',
    },
    homeWire: {
      endDate: '2026-11-20T16:45:00',
      isEnabled: false,
      startDate: '2026-07-05T02:20:00',
    },
    label: 'a disabled window',
    state: {
      endDate: '2026-11-20T22:45:00',
      isEnabled: false,
      startDate: '2026-07-05T08:20:00',
    },
  },
  { classicWire: null, homeWire: null, label: 'no window at all', state: null },
]

/**
 * Runs the {@link HolidayModeState} read contract against one dialect.
 * The read may be synchronous or not — that difference is real (Home
 * serves it from the synced `/context`, Classic fetches) and is not part
 * of the contract under test.
 * @param name - Implementation label used in the test titles.
 * @param wireOf - Picks, in a case, the window as that dialect's wire
 * holds it.
 * @param read - Encodes that window into the dialect's wire shape and
 * reads it back through the real facade.
 */
const describeHolidayModeStateContract = (
  name: string,
  wireOf: (wires: (typeof CASES)[number]) => BoundedWindow | null,
  read: (
    wire: BoundedWindow | null,
  ) => HolidayModeState | Promise<HolidayModeState | null> | null,
): void => {
  describe(`holidayModeState — ${name}`, () => {
    beforeEach(() => {
      resetHomeDevices()
      stopClockAt(BEFORE_EVERY_WINDOW)
    })

    afterEach(restartClock)

    it.each(CASES)(
      "projects $label from the wire's own clock onto the caller's",
      async (wires) => {
        await expect(
          Promise.resolve(read(wireOf(wires))),
        ).resolves.toStrictEqual(wires.state)
      },
    )

    // One meaning for both dialects: a window is on until its end, and
    // off from it, whatever flag the wire still holds then. MELCloud
    // Home keeps its flag after a window has closed (measured
    // 2026-11-21); what MELCloud Classic keeps is not measured, and the
    // state depends on neither. The end is judged on the wire's own
    // clock, which the second before it tells: read as UTC, the New
    // York end falls four hours early; read on the caller's clock, the
    // UTC one two hours early.
    it.each([
      {
        isEnabled: true,
        moment: 'a second before',
        now: '2026-04-10T18:29:59Z',
      },
      { isEnabled: false, moment: 'at', now: ENABLED_WINDOW_END },
      { isEnabled: false, moment: 'weeks after', now: '2026-06-01T00:00:00Z' },
    ])(
      'reads an enabled window $moment its end with isEnabled $isEnabled',
      async ({ isEnabled, now }) => {
        stopClockAt(now)

        await expect(
          Promise.resolve(read(wireOf(ENABLED_WINDOW))),
        ).resolves.toStrictEqual({ ...ENABLED_WINDOW.state, isEnabled })
      },
    )
  })
}

const classicFacade = (
  data: Parameters<typeof classicHolidayModeResponse>[0],
): ClassicBuildingFacade => {
  const registry = populatedClassicRegistry({
    buildings: [classicBuildingData()],
    devices: [classicAtaDevice()],
  })
  const api = createMockClassicApi({
    getHolidayMode: vi
      .fn<ClassicAPIAdapter['getHolidayMode']>()
      .mockResolvedValue(ok(classicHolidayModeResponse(data))),
    registry,
    timezone: CONTRACT_TIMEZONE,
  })
  return new ClassicBuildingFacade(api, defined(registry.buildings.getById(1)))
}

describeHolidayModeStateContract(
  'Classic zone',
  ({ classicWire }) => classicWire,
  async (wire) =>
    okValue(
      await classicFacade(
        wire === null
          ? { HMDefined: false }
          : {
              HMDefined: true,
              HMEnabled: wire.isEnabled,
              HMEndDate: wire.endDate,
              HMStartDate: wire.startDate,
            },
      ).getHolidayMode(),
    ),
)

const homeApi = (): HomeAPIAdapter =>
  createMockHomeApi({ timezone: CONTRACT_TIMEZONE })

const toHomeWire = (
  wire: BoundedWindow | null,
): { enabled: boolean; endDate: string; startDate: string } | null =>
  wire === null
    ? null
    : {
        enabled: wire.isEnabled,
        endDate: wire.endDate,
        startDate: wire.startDate,
      }

describeHolidayModeStateContract(
  'Home ATA device',
  ({ homeWire }) => homeWire,
  async (wire) => {
    const facade = new HomeDeviceAtaFacade(
      homeApi(),
      homeDevice({
        holidayMode: toHomeWire(wire),
        id: 'contract-ata',
        timeZone: HOME_UNIT_TIMEZONE,
      }),
    )
    return okValue(await facade.getHolidayMode())
  },
)

// The ATW facade inherits the method; asserting it here keeps the pair
// from drifting apart the way the protection getter once could.
describeHolidayModeStateContract(
  'Home ATW device',
  ({ homeWire }) => homeWire,
  async (wire) => {
    const facade = new HomeDeviceAtwFacade(
      homeApi(),
      homeAtwDevice({
        holidayMode: toHomeWire(wire),
        id: 'contract-atw',
        timeZone: HOME_UNIT_TIMEZONE,
      }),
    )
    return okValue(await facade.getHolidayMode())
  },
)

// Only Classic can express these: its `HM*` bounds are independently
// nullable, while the Home wire types both dates as required and uses a
// null descriptor as its single absence marker.
describe('holidayModeState — Classic-only wire shapes', () => {
  beforeEach(() => {
    stopClockAt(BEFORE_EVERY_WINDOW)
  })

  afterEach(restartClock)

  // No end to judge: the wire's flag is all there is.
  it('keeps an enabled window with no end enabled, whenever it is read', async () => {
    stopClockAt('2099-01-01T00:00:00Z')

    await expect(
      classicFacade({
        HMDefined: true,
        HMEnabled: true,
        HMEndDate: null,
        HMStartDate: '2026-05-12T21:00:00',
      }).getHolidayMode(),
    ).resolves.toStrictEqual({
      ok: true,
      value: {
        endDate: null,
        isEnabled: true,
        startDate: '2026-05-12T23:00:00',
      },
    })
  })

  it('keeps a null bound null instead of substituting its twin', async () => {
    await expect(
      classicFacade({
        HMDefined: true,
        HMEnabled: true,
        HMEndDate: '2026-05-12T21:00:00',
        HMStartDate: null,
      }).getHolidayMode(),
    ).resolves.toStrictEqual({
      ok: true,
      value: {
        endDate: '2026-05-12T23:00:00',
        isEnabled: true,
        startDate: null,
      },
    })
  })

  it('reads a configured-but-disabled window as a real state, not null', async () => {
    await expect(
      classicFacade({
        HMDefined: true,
        HMEnabled: false,
        HMEndDate: '2026-06-02T10:00:00',
        HMStartDate: '2026-06-01T07:00:00',
      }).getHolidayMode(),
    ).resolves.toStrictEqual({
      ok: true,
      value: {
        endDate: '2026-06-02T12:00:00',
        isEnabled: false,
        startDate: '2026-06-01T09:00:00',
      },
    })
  })
})

// Same clause as the protection kernel's, held on THIS method too: the
// level fallback lives in one shared helper today, and it is exactly a
// refactor splitting such helpers that dropped the fallback in 2026-03
// — each read pins its own guard.
describe('holiday read — level fallback', () => {
  it('falls back to the device level when the declared zone level refuses', async () => {
    const registry = populatedClassicRegistry({
      buildings: [classicBuildingData({ HMDefined: true })],
      devices: [classicAtaDevice()],
    })
    const getHolidayMode = vi
      .fn<ClassicAPIAdapter['getHolidayMode']>()
      .mockResolvedValueOnce(err({ kind: 'server', status: 401 }))
      .mockResolvedValueOnce(
        ok(classicHolidayModeResponse({ HMDefined: true })),
      )
    const facade = new ClassicBuildingFacade(
      createMockClassicApi({ getHolidayMode, registry }),
      defined(registry.buildings.getById(1)),
    )

    const result = await facade.getHolidayMode()

    expect(result.ok).toBe(true)
    expect(
      getHolidayMode.mock.calls.map(([{ params }]) => params.tableName),
    ).toStrictEqual(['Building', 'DeviceLocation'])
  })
})
