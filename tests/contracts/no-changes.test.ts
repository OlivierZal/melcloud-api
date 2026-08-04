import { describe, expect, it, vi } from 'vitest'

import type { ClassicAPIAdapter } from '../../src/api/classic-types.ts'
import type { HomeAPIAdapter } from '../../src/api/home-types.ts'
import { ClassicDeviceType } from '../../src/constants.ts'
import { ClassicRegistry } from '../../src/entities/index.ts'
import { NoChangesError } from '../../src/errors/index.ts'
import { ClassicDeviceAtaFacade } from '../../src/facades/classic-device-ata.ts'
import { HomeDeviceAtaFacade } from '../../src/facades/home-device-ata.ts'
import {
  assertClassicDeviceType,
  classicAreaData,
  classicAtaDevice,
  classicBuildingData,
  classicFloorData,
  createMockClassicApi,
} from '../classic-fixtures.ts'
import { cast, defined, mock } from '../helpers.ts'
import { homeDevice, homeTestRegistry } from '../home-fixtures.ts'

// `updateValues` answers one question on both dialects — is there
// anything to send? — and must answer it *before* the wire. A
// present-`undefined` key counts as absent on either side, because JS
// callers do send one.
//
// The mechanics differ, and that difference is not the contract: Home
// counts the keys surviving `omitUndefined`, Classic computes
// `EffectiveFlags` against the synced state and refuses on 0. Two
// independent implementations of one rule is exactly the shape that let
// `isAvailable` diverge silently at 100% coverage, so the clauses live
// here once and both answer them.
type NoOpKind = 'empty' | 'undefinedOnly'

const CASES: readonly { readonly kind: NoOpKind; readonly label: string }[] = [
  { kind: 'empty', label: 'an empty change set' },
  { kind: 'undefinedOnly', label: 'a set whose only key is present-undefined' },
]

/**
 * One write attempt against a freshly built facade, so the wire-call
 * count belongs to that attempt alone.
 */
interface Attempt {
  /**
   * How many times the write reached the wire.
   */
  readonly wireCalls: () => number
  /**
   * Performs the write.
   */
  readonly write: () => Promise<unknown>
}

/**
 * Runs the no-op refusal contract against one dialect.
 * @param name - Implementation label used in the test titles.
 * @param attempt - Builds a fresh facade and returns the write for that
 * change set, plus its wire-call counter. `'realChange'` must be a
 * genuine change for that dialect's fixture state.
 */
const describeNoChangesContract = (
  name: string,
  attempt: (kind: 'realChange' | NoOpKind) => Attempt,
): void => {
  describe(`updateValues — ${name}`, () => {
    it.each(CASES)('refuses $label with NoChangesError', async ({ kind }) => {
      await expect(attempt(kind).write()).rejects.toThrow(NoChangesError)
    })

    it.each(CASES)('sends nothing to the wire for $label', async ({ kind }) => {
      const { wireCalls, write } = attempt(kind)

      await expect(write()).rejects.toThrow(NoChangesError)

      expect(wireCalls()).toBe(0)
    })

    // Without this clause the two above would also pass on a facade that
    // refuses every write, including the ones it should send.
    it('sends a real change to the wire', async () => {
      const { wireCalls, write } = attempt('realChange')

      await write()

      expect(wireCalls()).toBe(1)
    })
  })
}

// The fixture device is powered on, so `Power: false` is the change
// Classic's state comparison cannot fold away.
//
// The present-`undefined` payload goes through `cast`, as every existing
// call site does: `exactOptionalPropertyTypes` forbids writing that key
// in TypeScript, which is precisely why the runtime has to tolerate it —
// only a JS caller can produce one.
const CLASSIC_VALUES = {
  empty: {},
  realChange: { Power: false },
  undefinedOnly: cast({ Power: undefined }),
} as const

describeNoChangesContract('Classic ATA device', (kind) => {
  const registry = new ClassicRegistry()
  registry.syncBuildings([classicBuildingData()])
  registry.syncFloors([classicFloorData()])
  registry.syncAreas([classicAreaData()])
  const device = classicAtaDevice()
  registry.syncDevices([device])
  const instance = defined(registry.devices.getById(device.DeviceID))
  assertClassicDeviceType(instance, ClassicDeviceType.Ata)
  const api = createMockClassicApi()
  const facade = new ClassicDeviceAtaFacade(api, registry, instance)
  return {
    wireCalls: (): number => vi.mocked(api.updateValues).mock.calls.length,
    write: async (): Promise<unknown> =>
      facade.updateValues(CLASSIC_VALUES[kind]),
  }
})

const HOME_VALUES = {
  empty: {},
  realChange: { power: false },
  undefinedOnly: cast({ power: undefined }),
} as const

describeNoChangesContract('Home ATA device', (kind) => {
  const updateValues = vi
    .fn<HomeAPIAdapter['updateValues']>()
    .mockResolvedValue()
  const api = mock<HomeAPIAdapter>({
    registry: cast(homeTestRegistry),
    updateValues,
  })
  const facade = new HomeDeviceAtaFacade(
    api,
    homeDevice({ id: `contract-no-changes-${kind}` }),
  )
  return {
    wireCalls: (): number => updateValues.mock.calls.length,
    write: async (): Promise<unknown> => facade.updateValues(HOME_VALUES[kind]),
  }
})

// Classic alone can fold a write away by comparing it to the synced
// state; Home has no such comparison, so this stays a dialect clause
// rather than a contract one.
describe('updateValues — Classic state comparison', () => {
  it('refuses a value already in the synced state', async () => {
    const registry = new ClassicRegistry()
    registry.syncBuildings([classicBuildingData()])
    registry.syncFloors([classicFloorData()])
    registry.syncAreas([classicAreaData()])
    const device = classicAtaDevice()
    registry.syncDevices([device])
    const instance = defined(registry.devices.getById(device.DeviceID))
    assertClassicDeviceType(instance, ClassicDeviceType.Ata)
    const api: ClassicAPIAdapter = createMockClassicApi()
    const facade = new ClassicDeviceAtaFacade(api, registry, instance)

    await expect(facade.updateValues({ Power: true })).rejects.toThrow(
      NoChangesError,
    )

    expect(api.updateValues).not.toHaveBeenCalled()
  })
})
