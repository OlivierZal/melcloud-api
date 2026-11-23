import { cast, defined, mock } from '@olivierzal/api-core/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  ClassicSetDevicePostData,
  HomeAtaValues,
} from '../../src/types/index.ts'
import {
  type ClassicDeviceType,
  type ClassicOperationMode as ClassicOperationModeType,
  ClassicOperationMode,
} from '../../src/constants.ts'
import { operationModeFromClassic } from '../../src/enum-mappings.ts'
import { NoChangesError } from '../../src/errors/index.ts'
import { ClassicDeviceAtaFacade } from '../../src/facades/classic-device-ata.ts'
import { HomeDeviceAtaFacade } from '../../src/facades/home-device-ata.ts'
import {
  classicAtaDevice,
  classicAtaDeviceData,
  classicBuildingData,
  createMockClassicApi,
  populatedClassicRegistry,
} from '../classic-fixtures.ts'
import {
  createMockHomeApi,
  homeDevice,
  resetHomeDevices,
} from '../home-fixtures.ts'

// Both ATA facades clamp a setpoint write against the unit's OWN
// advertised per-mode bounds before it reaches the wire — Classic
// against its `MinTempCoolDry`/`MaxTempHeat` list fields, Home through
// its `clampValues` hook over the same capability pairs. The fixtures
// advertise the same bounds on both dialects (cool/dry 16–31, heat
// 10–31), so one table asks both the same questions; the mode speaks
// the one group vocabulary (Classic-numbered) and each leg encodes it
// for its own wire.
const CASES: readonly {
  readonly delivered: number
  readonly label: string
  readonly mode: ClassicOperationModeType
  readonly requested: number
}[] = [
  {
    delivered: 16,
    label: 'lifts a setpoint below the cool floor up to it',
    mode: ClassicOperationMode.cool,
    requested: 10,
  },
  {
    delivered: 31,
    label: 'pulls a setpoint above the heat ceiling down to it',
    mode: ClassicOperationMode.heat,
    requested: 40,
  },
  {
    delivered: 22.5,
    label: 'passes an in-range setpoint through unchanged',
    mode: ClassicOperationMode.heat,
    requested: 22.5,
  },
]

// A unit holds a setpoint on its own step and nothing else, and the
// step is the unit's to advertise: half a degree, or a whole one.
// Measured 2026-11-23 on a half-degree unit of each dialect: Classic
// accepted 18.4, listed it until the unit next communicated (eight
// minutes), then answered the setpoint the unit held before, the write
// dropped; Home accepted 20.6 and answered 20.5 a minute later. So both
// facades round the setpoint to the unit's step BEFORE they clamp it,
// and the caller reads at once what the unit will hold. A tie goes up:
// one rule for both, where Home alone ended 20.25 on 20.
const STEP_CASES: readonly {
  readonly delivered: number
  readonly hasHalfDegrees: boolean
  readonly label: string
  readonly requested: number
}[] = [
  {
    delivered: 16.5,
    hasHalfDegrees: true,
    label: 'rounds 16.4 up to the half degree above on a half-degree unit',
    requested: 16.4,
  },
  {
    delivered: 15.5,
    hasHalfDegrees: true,
    label: 'rounds 15.6 down to the half degree below on a half-degree unit',
    requested: 15.6,
  },
  {
    delivered: 15,
    hasHalfDegrees: true,
    label: 'rounds 15.2 down to the whole degree on a half-degree unit',
    requested: 15.2,
  },
  {
    delivered: 21,
    hasHalfDegrees: true,
    label: 'sends a tie between two half degrees up',
    requested: 20.75,
  },
  {
    delivered: 16,
    hasHalfDegrees: false,
    label: 'rounds 16.4 down to the whole degree on a whole-degree unit',
    requested: 16.4,
  },
  {
    delivered: 17,
    hasHalfDegrees: false,
    label: 'sends a half degree up on a whole-degree unit',
    requested: 16.5,
  },
  {
    delivered: 31,
    hasHalfDegrees: true,
    label: 'clamps what the rounding lifted past the ceiling',
    requested: 31.4,
  },
]

/**
 * Runs the setpoint-clamp contract against one dialect.
 * @param name - Implementation label used in the test titles.
 * @param write - Pushes a setpoint update in that dialect's own wire
 * vocabulary, on a unit of the given step, and answers the setpoint
 * that reached the wire.
 */
const describeAtaSetpointClampContract = (
  name: string,
  write: (
    mode: ClassicOperationModeType,
    setTemperature: number,
    hasHalfDegrees?: boolean,
  ) => Promise<number>,
): void => {
  describe(`ataSetpointClamp — ${name}`, () => {
    beforeEach(resetHomeDevices)

    it.each(CASES)('$label', async ({ delivered, mode, requested }) => {
      await expect(write(mode, requested)).resolves.toBe(delivered)
    })

    it.each(STEP_CASES)(
      '$label',
      async ({ delivered, hasHalfDegrees, requested }) => {
        await expect(
          write(ClassicOperationMode.heat, requested, hasHalfDegrees),
        ).resolves.toBe(delivered)
      },
    )
  })
}

const classicClampFacade = ({
  hasHalfDegrees = true,
  held = 24,
}: { hasHalfDegrees?: boolean; held?: number } = {}): {
  api: ReturnType<typeof createMockClassicApi>
  facade: ClassicDeviceAtaFacade
} => {
  const registry = populatedClassicRegistry({
    buildings: [classicBuildingData()],
    devices: [
      classicAtaDevice({
        Device: classicAtaDeviceData({
          HasHalfDegreeIncrements: hasHalfDegrees,
          SetTemperature: held,
        }),
      }),
    ],
  })
  const api = createMockClassicApi({ registry })
  return {
    api,
    facade: new ClassicDeviceAtaFacade(
      api,
      defined(registry.devices.getById(1000)),
    ),
  }
}

const classicClampWrite = async (
  values: Parameters<ClassicDeviceAtaFacade['updateValues']>[0],
  hasHalfDegrees = true,
): Promise<number> => {
  const { api, facade } = classicClampFacade({ hasHalfDegrees })
  await facade.updateValues(values)
  return mock<ClassicSetDevicePostData<typeof ClassicDeviceType.Ata>>(
    defined(vi.mocked(api.updateValues).mock.lastCall?.[0]).postData,
  ).SetTemperature
}

const homeClampWrite = async (
  values: Parameters<HomeDeviceAtaFacade['updateValues']>[0],
  hasHalfDegrees = true,
): Promise<number> => {
  const api = createMockHomeApi()
  const facade = new HomeDeviceAtaFacade(
    api,
    homeDevice({
      capabilities: { hasHalfDegreeIncrements: hasHalfDegrees },
      id: 'contract-clamp',
    }),
  )
  await facade.updateValues(values)
  // The adapter's payload type is the ATA-or-ATW union; this leg only
  // ever writes through the ATA facade.
  return defined(
    mock<HomeAtaValues>(defined(vi.mocked(api.updateValues).mock.lastCall?.[1]))
      .setTemperature,
  )
}

describeAtaSetpointClampContract(
  'Classic ATA device',
  async (mode, value, hasHalfDegrees) =>
    classicClampWrite(
      { OperationMode: mode, SetTemperature: value },
      hasHalfDegrees,
    ),
)

describeAtaSetpointClampContract(
  'Home ATA device',
  async (mode, value, hasHalfDegrees) =>
    homeClampWrite(
      { operationMode: operationModeFromClassic[mode], setTemperature: value },
      hasHalfDegrees,
    ),
)

// The step the rounding reads is a read of its own on both dialects,
// from the half-degree capability each API advertises.
describe('ataSetpointClamp — the step a unit advertises', () => {
  beforeEach(resetHomeDevices)

  it.each([
    { hasHalfDegrees: true, step: 0.5 },
    { hasHalfDegrees: false, step: 1 },
  ])(
    'reads $step on both dialects when half degrees are $hasHalfDegrees',
    ({ hasHalfDegrees, step }) => {
      const home = new HomeDeviceAtaFacade(
        createMockHomeApi(),
        homeDevice({
          capabilities: { hasHalfDegreeIncrements: hasHalfDegrees },
          id: 'contract-step',
        }),
      )

      expect(
        classicClampFacade({ hasHalfDegrees }).facade.temperatureStep,
      ).toBe(step)
      expect(home.temperatureStep).toBe(step)
    },
  )
})

// Classic refuses a write that changes nothing before any request, and
// the setpoint is judged as the unit will hold it: asked for a value
// its step or its bounds bring back to the one it holds, the unit is
// sent nothing. The fixture unit heats, up to 31.
describe('ataSetpointClamp — Classic sends nothing for the setpoint the unit holds', () => {
  it.each([
    { held: 24, label: 'a value its step rounds to it', requested: 24.2 },
    { held: 24, label: 'the value itself', requested: 24 },
    { held: 31, label: 'a value its ceiling clamps to it', requested: 40 },
  ])('refuses $label with NoChangesError', async ({ held, requested }) => {
    const { api, facade } = classicClampFacade({ held })

    await expect(
      facade.updateValues({ SetTemperature: requested }),
    ).rejects.toThrow(NoChangesError)
    expect(api.updateValues).not.toHaveBeenCalled()
  })
})

// The shared escape hatch is contract too: a mode outside the known
// vocabulary resolves no range, and the setpoint then goes UNCLAMPED —
// inventing a range would silently clamp with the wrong bounds. The
// `cast` is the deliberate type-breach boundary: an out-of-vocabulary
// mode is exactly what the compiled types refuse.
describe('ataSetpointClamp — out-of-vocabulary mode goes unclamped', () => {
  beforeEach(resetHomeDevices)

  it('classic passes the raw setpoint through', async () => {
    await expect(
      classicClampWrite(cast({ OperationMode: 99, SetTemperature: 50 })),
    ).resolves.toBe(50)
  })

  it('home passes the raw setpoint through', async () => {
    await expect(
      homeClampWrite(cast({ operationMode: 'Mystery', setTemperature: 50 })),
    ).resolves.toBe(50)
  })
})
