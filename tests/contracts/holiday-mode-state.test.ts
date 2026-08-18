import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ClassicAPIAdapter } from '../../src/api/classic-types.ts'
import type { HomeAPIAdapter } from '../../src/api/home-types.ts'
import type { HolidayModeState } from '../../src/holiday-mode.ts'
import { ClassicBuildingFacade } from '../../src/facades/classic-building.ts'
import { HomeDeviceAtaFacade } from '../../src/facades/home-device-ata.ts'
import { HomeDeviceAtwFacade } from '../../src/facades/home-device-atw.ts'
import { ok } from '../../src/types/index.ts'
import {
  classicAtaDevice,
  classicBuildingData,
  classicHolidayModeResponse,
  createMockClassicApi,
  populatedClassicRegistry,
} from '../classic-fixtures.ts'
import { defined, okValue } from '../helpers.ts'
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

// Both wires store UTC wall clock while the contract speaks the
// caller's (`api.timezone`, pinned here so no host zone can leak in).
const CONTRACT_TIMEZONE = 'Europe/Paris'

// The neutral holiday state is the same contract on both dialects, so
// the clauses live here once and every implementation answers them.
// Each case is a wire/state PAIR: the wire side is what the API
// serves (UTC), the state side the same instants on the caller's
// clock. The windows straddle the DST switch — a winter bound (+1) and
// a summer bound (+2) in one case — so a projection that hardcodes
// either offset has to change the result; start and end stay far apart
// and ordered, so a swap has to as well.
const CASES: readonly {
  readonly label: string
  readonly state: BoundedWindow | null
  readonly wire: BoundedWindow | null
}[] = [
  {
    label: 'enabled window straddling the DST switch',
    state: {
      endDate: '2026-04-10T20:30:00',
      isEnabled: true,
      startDate: '2026-03-01T09:15:00',
    },
    wire: {
      endDate: '2026-04-10T18:30:00',
      isEnabled: true,
      startDate: '2026-03-01T08:15:00',
    },
  },
  {
    label: 'disabled window',
    state: {
      endDate: '2026-11-20T22:45:00',
      isEnabled: false,
      startDate: '2026-07-05T08:20:00',
    },
    wire: {
      endDate: '2026-11-20T21:45:00',
      isEnabled: false,
      startDate: '2026-07-05T06:20:00',
    },
  },
  { label: 'never configured', state: null, wire: null },
]

/**
 * Runs the {@link HolidayModeState} read contract against one dialect.
 * The read may be synchronous or not — that difference is real (Home
 * serves it from the synced `/context`, Classic fetches) and is not part
 * of the contract under test.
 * @param name - Implementation label used in the test titles.
 * @param read - Encodes the neutral state into that dialect's wire shape
 * and reads it back through the real facade.
 */
const describeHolidayModeStateContract = (
  name: string,
  read: (
    wire: BoundedWindow | null,
  ) => HolidayModeState | Promise<HolidayModeState | null> | null,
): void => {
  describe(`holidayModeState — ${name}`, () => {
    beforeEach(resetHomeDevices)

    it.each(CASES)(
      "projects a $label from the wire's UTC onto the caller's clock",
      async ({ state, wire }) => {
        await expect(Promise.resolve(read(wire))).resolves.toStrictEqual(state)
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
    timezone: CONTRACT_TIMEZONE,
  })
  return new ClassicBuildingFacade(
    api,
    registry,
    defined(registry.buildings.getById(1)),
  )
}

describeHolidayModeStateContract('Classic zone', async (wire) =>
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

describeHolidayModeStateContract('Home ATA device', async (wire) => {
  const facade = new HomeDeviceAtaFacade(
    homeApi(),
    homeDevice({ holidayMode: toHomeWire(wire), id: 'contract-ata' }),
  )
  return okValue(await facade.getHolidayMode())
})

// The ATW facade inherits the method; asserting it here keeps the pair
// from drifting apart the way the protection getter once could.
describeHolidayModeStateContract('Home ATW device', async (wire) => {
  const facade = new HomeDeviceAtwFacade(
    homeApi(),
    homeAtwDevice({ holidayMode: toHomeWire(wire), id: 'contract-atw' }),
  )
  return okValue(await facade.getHolidayMode())
})

// Only Classic can express these: its `HM*` bounds are independently
// nullable, while the Home wire types both dates as required and uses a
// null descriptor as its single absence marker.
describe('holidayModeState — Classic-only wire shapes', () => {
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
