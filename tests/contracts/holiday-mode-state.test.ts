import { describe, expect, it, vi } from 'vitest'

import type { ClassicAPIAdapter } from '../../src/api/classic-types.ts'
import type { HomeAPIAdapter } from '../../src/api/home-types.ts'
import type { HolidayModeState } from '../../src/holiday-mode.ts'
import { ClassicRegistry } from '../../src/entities/index.ts'
import { ClassicBuildingFacade } from '../../src/facades/classic-building.ts'
import { HomeDeviceAtaFacade } from '../../src/facades/home-device-ata.ts'
import { HomeDeviceAtwFacade } from '../../src/facades/home-device-atw.ts'
import { ok } from '../../src/types/index.ts'
import {
  classicAtaDevice,
  classicBuildingData,
  classicHolidayModeResponse,
  createMockClassicApi,
} from '../classic-fixtures.ts'
import { cast, defined, mock, okValue } from '../helpers.ts'
import {
  homeAtwDevice,
  homeDevice,
  homeTestRegistry,
} from '../home-fixtures.ts'

/**
 * A window both dialects can carry: the wire's date fields are never null.
 */
interface BoundedWindow extends HolidayModeState {
  readonly endDate: string
  readonly startDate: string
}

// The neutral holiday state is the same contract on both dialects, so the
// clauses live here once and every implementation answers them. Start and
// end are deliberately far apart and ordered: a start/end swap has to
// change the result.
const CASES: readonly {
  readonly label: string
  readonly state: BoundedWindow | null
}[] = [
  {
    label: 'enabled window',
    state: {
      endDate: '2026-03-10T18:30:00',
      isEnabled: true,
      startDate: '2026-03-01T08:15:00',
    },
  },
  {
    label: 'disabled window',
    state: {
      endDate: '2026-04-20T21:45:00',
      isEnabled: false,
      startDate: '2026-04-05T06:20:00',
    },
  },
  { label: 'never configured', state: null },
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
    state: BoundedWindow | null,
  ) => HolidayModeState | Promise<HolidayModeState | null> | null,
): void => {
  describe(`holidayModeState — ${name}`, () => {
    it.each(CASES)('round-trips a $label unchanged', async ({ state }) => {
      await expect(Promise.resolve(read(state))).resolves.toStrictEqual(state)
    })
  })
}

const classicFacade = (
  data: Parameters<typeof classicHolidayModeResponse>[0],
): ClassicBuildingFacade => {
  const registry = new ClassicRegistry()
  registry.syncBuildings([classicBuildingData()])
  registry.syncDevices([classicAtaDevice()])
  const api = createMockClassicApi({
    getHolidayMode: vi
      .fn<ClassicAPIAdapter['getHolidayMode']>()
      .mockResolvedValue(ok(classicHolidayModeResponse(data))),
  })
  return new ClassicBuildingFacade(
    api,
    registry,
    defined(registry.buildings.getById(1)),
  )
}

describeHolidayModeStateContract('Classic zone', async (state) =>
  okValue(
    await classicFacade(
      state === null
        ? { HMDefined: false }
        : {
            HMDefined: true,
            HMEnabled: state.isEnabled,
            HMEndDate: state.endDate,
            HMStartDate: state.startDate,
          },
    ).getHolidayMode(),
  ),
)

const homeApi = (): HomeAPIAdapter =>
  mock<HomeAPIAdapter>({ registry: cast(homeTestRegistry) })

const toHomeWire = (
  state: BoundedWindow | null,
): { enabled: boolean; endDate: string; startDate: string } | null =>
  state === null
    ? null
    : {
        enabled: state.isEnabled,
        endDate: state.endDate,
        startDate: state.startDate,
      }

describeHolidayModeStateContract('Home ATA device', (state) => {
  const facade = new HomeDeviceAtaFacade(
    homeApi(),
    homeDevice({ holidayMode: toHomeWire(state), id: 'contract-ata' }),
  )
  return facade.holidayMode
})

// The ATW facade inherits the getter; asserting it here keeps the pair
// from drifting apart the way the protection getter once could.
describeHolidayModeStateContract('Home ATW device', (state) => {
  const facade = new HomeDeviceAtwFacade(
    homeApi(),
    homeAtwDevice({ holidayMode: toHomeWire(state), id: 'contract-atw' }),
  )
  return facade.holidayMode
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
        HMEndDate: '2026-05-12T23:00:00',
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
        HMEndDate: '2026-06-02T12:00:00',
        HMStartDate: '2026-06-01T09:00:00',
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
