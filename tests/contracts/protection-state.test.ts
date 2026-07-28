import { describe, expect, it, vi } from 'vitest'

import type { ClassicAPIAdapter } from '../../src/api/classic-types.ts'
import type { HomeAPIAdapter } from '../../src/api/home-types.ts'
import type { ProtectionState } from '../../src/protection.ts'
import { ClassicRegistry } from '../../src/entities/index.ts'
import { ClassicBuildingFacade } from '../../src/facades/classic-building.ts'
import { HomeDeviceAtaFacade } from '../../src/facades/home-device-ata.ts'
import { HomeDeviceAtwFacade } from '../../src/facades/home-device-atw.ts'
import { ok } from '../../src/types/index.ts'
import {
  classicAtaDevice,
  classicBuildingData,
  classicFrostProtectionResponse,
  createMockClassicApi,
} from '../classic-fixtures.ts'
import { cast, defined, mock, okValue } from '../helpers.ts'
import {
  homeAtwDevice,
  homeDevice,
  homeTestRegistry,
} from '../home-fixtures.ts'

// The neutral protection state is the same contract on both dialects, so
// the clauses live here once and every implementation answers them. The
// values are deliberately asymmetric and away from the clamp bounds
// (6/12, never 4/16): a min/max swap has to change the result.
const CASES: readonly {
  readonly label: string
  readonly state: ProtectionState | null
}[] = [
  { label: 'enabled window', state: { isEnabled: true, max: 12, min: 6 } },
  { label: 'disabled window', state: { isEnabled: false, max: 11, min: 7 } },
  { label: 'never configured', state: null },
]

/**
 * Runs the {@link ProtectionState} read contract against one dialect.
 * The read may be synchronous or not — that difference is real (Home
 * serves it from the synced `/context`, Classic fetches) and is not
 * part of the contract under test.
 * @param name - Implementation label used in the test titles.
 * @param read - Encodes the neutral state into that dialect's wire shape
 * and reads it back through the real facade.
 */
const describeProtectionStateContract = (
  name: string,
  read: (
    state: ProtectionState | null,
  ) => Promise<ProtectionState | null> | ProtectionState | null,
): void => {
  describe(`protectionState — ${name}`, () => {
    it.each(CASES)('round-trips a $label unchanged', async ({ state }) => {
      await expect(Promise.resolve(read(state))).resolves.toStrictEqual(state)
    })
  })
}

describeProtectionStateContract('Classic zone', async (state) => {
  const registry = new ClassicRegistry()
  registry.syncBuildings([classicBuildingData()])
  registry.syncDevices([classicAtaDevice()])
  const api = createMockClassicApi({
    getFrostProtection: vi
      .fn<ClassicAPIAdapter['getFrostProtection']>()
      .mockResolvedValue(
        ok(
          classicFrostProtectionResponse(
            state === null
              ? { FPDefined: false }
              : {
                  FPDefined: true,
                  FPEnabled: state.isEnabled,
                  FPMaxTemperature: state.max,
                  FPMinTemperature: state.min,
                },
          ),
        ),
      ),
  })
  const facade = new ClassicBuildingFacade(
    api,
    registry,
    defined(registry.buildings.getById(1)),
  )
  return okValue(await facade.getFrostProtection())
})

const homeApi = (): HomeAPIAdapter =>
  mock<HomeAPIAdapter>({ registry: cast(homeTestRegistry) })

const toHomeWire = (
  state: ProtectionState | null,
): { enabled: boolean; max: number; min: number } | null =>
  state === null
    ? null
    : { enabled: state.isEnabled, max: state.max, min: state.min }

describeProtectionStateContract('Home ATA device', (state) => {
  const facade = new HomeDeviceAtaFacade(
    homeApi(),
    homeDevice({ frostProtection: toHomeWire(state), id: 'contract-ata' }),
  )
  return facade.frostProtection
})

// The ATW facade inherits the getter and was never exercised for it: the
// coverage gate was satisfied by the ATA path alone.
describeProtectionStateContract('Home ATW device', (state) => {
  const facade = new HomeDeviceAtwFacade(
    homeApi(),
    homeAtwDevice({ frostProtection: toHomeWire(state), id: 'contract-atw' }),
  )
  return facade.frostProtection
})

describe('protectionState — overheat shares the shape', () => {
  it('reads the overheat descriptor through the same contract', () => {
    const state = { isEnabled: true, max: 37, min: 35 }
    const facade = new HomeDeviceAtaFacade(
      homeApi(),
      homeDevice({
        id: 'contract-overheat',
        overheatProtection: toHomeWire(state),
      }),
    )

    expect(facade.overheatProtection).toStrictEqual(state)
  })
})

// The Classic dialect is the only one that can answer "configured but
// off": Home has no *Defined flag, so `null` is its only absence marker.
describe('protectionState — Classic *Defined semantics', () => {
  it('reads a configured-but-disabled window as a real state, not null', async () => {
    const registry = new ClassicRegistry()
    registry.syncBuildings([classicBuildingData()])
    registry.syncDevices([classicAtaDevice()])
    const api = createMockClassicApi({
      getFrostProtection: vi
        .fn<ClassicAPIAdapter['getFrostProtection']>()
        .mockResolvedValue(
          ok(
            classicFrostProtectionResponse({
              FPDefined: true,
              FPEnabled: false,
              FPMaxTemperature: 12,
              FPMinTemperature: 6,
            }),
          ),
        ),
    })
    const facade = new ClassicBuildingFacade(
      api,
      registry,
      defined(registry.buildings.getById(1)),
    )

    await expect(facade.getFrostProtection()).resolves.toStrictEqual({
      ok: true,
      value: { isEnabled: false, max: 12, min: 6 },
    })
  })
})
