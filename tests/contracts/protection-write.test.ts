import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ClassicAPIAdapter } from '../../src/api/classic-types.ts'
import type { HomeAPIAdapter } from '../../src/api/home-types.ts'
import type { ProtectionUpdate } from '../../src/protection.ts'
import {
  type TypedHomeDeviceData,
  HomeRegistry,
} from '../../src/entities/home-registry.ts'
import { ClassicBuildingFacade } from '../../src/facades/classic-building.ts'
import { ClassicDeviceAtaFacade } from '../../src/facades/classic-device-ata.ts'
import { HomeDeviceAtaFacade } from '../../src/facades/home-device-ata.ts'
import { HomeDeviceAtwFacade } from '../../src/facades/home-device-atw.ts'
import { HomeFacadeManager } from '../../src/facades/home-manager.ts'
import {
  classicAtaDevice,
  classicBuildingData,
  createMockClassicApi,
  populatedClassicRegistry,
} from '../classic-fixtures.ts'
import { defined } from '../helpers.ts'
import {
  createMockHomeApi,
  homeAtwDevice,
  homeBuildingRef,
  homeDevice,
  resetHomeDevices,
  typedHomeDeviceData,
} from '../home-fixtures.ts'

// A protection write is clamped into the range the official UIs
// enforce BEFORE it reaches the wire, on every dialect and level — the
// shared `clampFrostProtection`/`clampOverheatProtection` vocabulary,
// so a direct SDK call cannot escape the bounds. The wire spelling
// differs (Classic `Enabled`/`MaximumTemperature`/`MinimumTemperature`,
// Home `enabled`/`max`/`min` with unit buckets) and is not the
// contract; each leg decodes its own capture back into the neutral
// form. Values sit away from symmetric bounds so a min/max swap has to
// change the result.
const FROST_CASES: readonly {
  readonly label: string
  readonly update: ProtectionUpdate
  readonly wire: { readonly max: number; readonly min: number }
}[] = [
  {
    label: 'passes an in-range window through unchanged',
    update: { isEnabled: true, max: 12, min: 6 },
    wire: { max: 12, min: 6 },
  },
  {
    label: 'pulls an out-of-range window into the bounds',
    update: { isEnabled: true, max: 50, min: -20 },
    wire: { max: 16, min: 4 },
  },
  {
    label: 'pushes a gapless window apart',
    update: { isEnabled: false, max: 15, min: 14 },
    wire: { max: 16, min: 14 },
  },
]

// Overheat lives on [31, 40] with the same 2° gap rule.
const OVERHEAT_CASES: readonly {
  readonly label: string
  readonly update: ProtectionUpdate
  readonly wire: { readonly max: number; readonly min: number }
}[] = [
  {
    label: 'passes an in-range window through unchanged',
    update: { isEnabled: true, max: 37, min: 35 },
    wire: { max: 37, min: 35 },
  },
  {
    label: 'pulls an out-of-range window into the bounds',
    update: { isEnabled: true, max: 90, min: 10 },
    wire: { max: 40, min: 31 },
  },
]

/**
 * Runs one protection-write contract (frost or overheat) against one
 * implementation.
 * @param title - Contract and implementation label of the describe.
 * @param cases - The clamp table the implementation must answer.
 * @param write - Applies the update through the real facade and decodes
 * what reached that dialect's wire back into the neutral form.
 */
const describeProtectionWriteContract = (
  title: string,
  cases: typeof FROST_CASES,
  write: (update: ProtectionUpdate) => Promise<ProtectionUpdate>,
): void => {
  describe(title, () => {
    beforeEach(resetHomeDevices)

    it.each(cases)('$label', async ({ update, wire }) => {
      await expect(write(update)).resolves.toStrictEqual({
        isEnabled: update.isEnabled,
        ...wire,
      })
    })
  })
}

const classicFrostWrite = async (
  buildFacade: (
    api: ClassicAPIAdapter,
  ) => ClassicBuildingFacade | ClassicDeviceAtaFacade,
  update: ProtectionUpdate,
): Promise<ProtectionUpdate> => {
  const updateFrostProtection = vi
    .fn<ClassicAPIAdapter['updateFrostProtection']>()
    .mockResolvedValue({ AttributeErrors: null, Success: true })
  const facade = buildFacade(createMockClassicApi({ updateFrostProtection }))
  await facade.updateFrostProtection(update)
  const { postData } = defined(updateFrostProtection.mock.lastCall?.[0])
  return {
    isEnabled: postData.Enabled,
    max: postData.MaximumTemperature,
    min: postData.MinimumTemperature,
  }
}

const decodeHomeProtectionWrite = (wireBody: {
  enabled: boolean
  max: number
  min: number
}): ProtectionUpdate => ({
  isEnabled: wireBody.enabled,
  max: wireBody.max,
  min: wireBody.min,
})

describeProtectionWriteContract(
  'frostProtectionWrite — Classic building',
  FROST_CASES,
  async (update) =>
    classicFrostWrite((api) => {
      const registry = populatedClassicRegistry({
        buildings: [classicBuildingData()],
        devices: [classicAtaDevice()],
      })
      return new ClassicBuildingFacade(
        api,
        registry,
        defined(registry.buildings.getById(1)),
      )
    }, update),
)

describeProtectionWriteContract(
  'frostProtectionWrite — Classic ATA device',
  FROST_CASES,
  async (update) =>
    classicFrostWrite((api) => {
      const registry = populatedClassicRegistry({
        buildings: [classicBuildingData()],
        devices: [classicAtaDevice()],
      })
      return new ClassicDeviceAtaFacade(
        api,
        registry,
        defined(registry.devices.getById(1000)),
      )
    }, update),
)

describeProtectionWriteContract(
  'frostProtectionWrite — Home ATA device',
  FROST_CASES,
  async (update) => {
    const api = createMockHomeApi()
    const facade = new HomeDeviceAtaFacade(
      api,
      homeDevice({ id: 'contract-frost-write-ata' }),
    )
    await facade.updateFrostProtection(update)
    return decodeHomeProtectionWrite(
      defined(vi.mocked(api.updateFrostProtection).mock.lastCall?.[0]),
    )
  },
)

describeProtectionWriteContract(
  'frostProtectionWrite — Home ATW device',
  FROST_CASES,
  async (update) => {
    const api = createMockHomeApi()
    const facade = new HomeDeviceAtwFacade(
      api,
      homeAtwDevice({ id: 'contract-frost-write-atw' }),
    )
    await facade.updateFrostProtection(update)
    return decodeHomeProtectionWrite(
      defined(vi.mocked(api.updateFrostProtection).mock.lastCall?.[0]),
    )
  },
)

// A Home building over its own private registry, so member setups never
// leak into the shared test registry.
const homeBuildingWith = (
  api: HomeAPIAdapter,
  members: readonly TypedHomeDeviceData[],
): ReturnType<HomeFacadeManager['getBuilding']> => {
  api.registry.syncDevices([...members])
  const manager = new HomeFacadeManager(api)
  return manager.getBuilding('home-building-1')
}

describeProtectionWriteContract(
  'frostProtectionWrite — Home building',
  FROST_CASES,
  async (update) => {
    const api = createMockHomeApi({ registry: new HomeRegistry() })
    const facade = defined(
      homeBuildingWith(api, [
        typedHomeDeviceData(
          { id: 'frost-write-member' },
          { building: homeBuildingRef() },
        ),
      ]),
    )
    await facade.updateFrostProtection(update)
    return decodeHomeProtectionWrite(
      defined(vi.mocked(api.updateFrostProtection).mock.lastCall?.[0]),
    )
  },
)

// Overheat is Home-only on the wire, so its cross-implementation legs
// are the Home targets that can hold one; the ATW drop (a write that
// resolves without a wire call) is pinned by the facade unit tests.
describeProtectionWriteContract(
  'overheatProtectionWrite — Home ATA device',
  OVERHEAT_CASES,
  async (update) => {
    const api = createMockHomeApi()
    const facade = new HomeDeviceAtaFacade(
      api,
      homeDevice({ id: 'contract-overheat-write-ata' }),
    )
    await facade.updateOverheatProtection(update)
    return decodeHomeProtectionWrite(
      defined(vi.mocked(api.updateOverheatProtection).mock.lastCall?.[0]),
    )
  },
)

describeProtectionWriteContract(
  'overheatProtectionWrite — Home building',
  OVERHEAT_CASES,
  async (update) => {
    const api = createMockHomeApi({ registry: new HomeRegistry() })
    const facade = defined(
      homeBuildingWith(api, [
        typedHomeDeviceData(
          { id: 'overheat-write-member' },
          { building: homeBuildingRef() },
        ),
      ]),
    )
    await facade.updateOverheatProtection(update)
    return decodeHomeProtectionWrite(
      defined(vi.mocked(api.updateOverheatProtection).mock.lastCall?.[0]),
    )
  },
)
