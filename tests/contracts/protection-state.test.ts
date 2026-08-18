import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ClassicAPIAdapter } from '../../src/api/classic-types.ts'
import type { ProtectionState } from '../../src/protection.ts'
import { ClassicBuildingFacade } from '../../src/facades/classic-building.ts'
import { HomeDeviceAtaFacade } from '../../src/facades/home-device-ata.ts'
import { HomeDeviceAtwFacade } from '../../src/facades/home-device-atw.ts'
import { ok } from '../../src/types/index.ts'
import {
  classicAtaDevice,
  classicBuildingData,
  classicFrostProtectionResponse,
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
 * Runs the {@link ProtectionState} read contract against one dialect:
 * both answer the SAME async method (Home serves it from the synced
 * `/context` without a wire call, Classic fetches — a mechanic, not
 * the contract).
 * @param name - Implementation label used in the test titles.
 * @param read - Encodes the neutral state into that dialect's wire shape
 * and reads it back through the real facade.
 */
const describeProtectionStateContract = (
  name: string,
  read: (state: ProtectionState | null) => Promise<ProtectionState | null>,
): void => {
  describe(`protectionState — ${name}`, () => {
    beforeEach(resetHomeDevices)

    it.each(CASES)('round-trips a $label unchanged', async ({ state }) => {
      await expect(read(state)).resolves.toStrictEqual(state)
    })
  })
}

describeProtectionStateContract('Classic zone', async (state) => {
  const registry = populatedClassicRegistry({
    buildings: [classicBuildingData()],
    devices: [classicAtaDevice()],
  })
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

const toHomeWire = (
  state: ProtectionState | null,
): { enabled: boolean; max: number; min: number } | null =>
  state === null
    ? null
    : { enabled: state.isEnabled, max: state.max, min: state.min }

describeProtectionStateContract('Home ATA device', async (state) => {
  const facade = new HomeDeviceAtaFacade(
    createMockHomeApi(),
    homeDevice({ frostProtection: toHomeWire(state), id: 'contract-ata' }),
  )
  return okValue(await facade.getFrostProtection())
})

// The ATW facade inherits the method and was never exercised for it: the
// coverage gate was satisfied by the ATA path alone.
describeProtectionStateContract('Home ATW device', async (state) => {
  const facade = new HomeDeviceAtwFacade(
    createMockHomeApi(),
    homeAtwDevice({ frostProtection: toHomeWire(state), id: 'contract-atw' }),
  )
  return okValue(await facade.getFrostProtection())
})

describe('protectionState — overheat shares the shape', () => {
  beforeEach(resetHomeDevices)

  it('reads the overheat descriptor through the same contract', async () => {
    const state = { isEnabled: true, max: 37, min: 35 }
    const facade = new HomeDeviceAtaFacade(
      createMockHomeApi(),
      homeDevice({
        id: 'contract-overheat',
        overheatProtection: toHomeWire(state),
      }),
    )

    await expect(facade.getOverheatProtection()).resolves.toStrictEqual(
      ok(state),
    )
  })

  it('answers null on an ATW unit without a type guard', async () => {
    const facade = new HomeDeviceAtwFacade(
      createMockHomeApi(),
      homeAtwDevice({ id: 'contract-overheat-atw' }),
    )

    await expect(facade.getOverheatProtection()).resolves.toStrictEqual(
      ok(null),
    )
  })
})

// The Classic dialect is the only one that can answer "configured but
// off": Home has no *Defined flag, so `null` is its only absence marker.
describe('protectionState — Classic *Defined semantics', () => {
  it('reads a configured-but-disabled window as a real state, not null', async () => {
    const registry = populatedClassicRegistry({
      buildings: [classicBuildingData()],
      devices: [classicAtaDevice()],
    })
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
