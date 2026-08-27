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
import { ClassicDeviceAtaFacade } from '../../src/facades/classic-device-ata.ts'
import { HomeDeviceAtaFacade } from '../../src/facades/home-device-ata.ts'
import {
  classicAtaDevice,
  classicBuildingData,
  createMockClassicApi,
  populatedClassicRegistry,
} from '../classic-fixtures.ts'
import { cast, defined, mock } from '../helpers.ts'
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

/**
 * Runs the setpoint-clamp contract against one dialect.
 * @param name - Implementation label used in the test titles.
 * @param write - Pushes a setpoint update in that dialect's own wire
 * vocabulary and answers the setpoint that reached the wire.
 */
const describeAtaSetpointClampContract = (
  name: string,
  write: (
    mode: ClassicOperationModeType,
    setTemperature: number,
  ) => Promise<number>,
): void => {
  describe(`ataSetpointClamp — ${name}`, () => {
    beforeEach(resetHomeDevices)

    it.each(CASES)('$label', async ({ delivered, mode, requested }) => {
      await expect(write(mode, requested)).resolves.toBe(delivered)
    })
  })
}

const classicClampWrite = async (
  values: Parameters<ClassicDeviceAtaFacade['updateValues']>[0],
): Promise<number> => {
  const registry = populatedClassicRegistry({
    buildings: [classicBuildingData()],
    devices: [classicAtaDevice()],
  })
  const api = createMockClassicApi()
  const facade = new ClassicDeviceAtaFacade(
    api,
    registry,
    defined(registry.devices.getById(1000)),
  )
  await facade.updateValues(values)
  return mock<ClassicSetDevicePostData<typeof ClassicDeviceType.Ata>>(
    defined(vi.mocked(api.updateValues).mock.lastCall?.[0]).postData,
  ).SetTemperature
}

const homeClampWrite = async (
  values: Parameters<HomeDeviceAtaFacade['updateValues']>[0],
): Promise<number> => {
  const api = createMockHomeApi()
  const facade = new HomeDeviceAtaFacade(
    api,
    homeDevice({ id: 'contract-clamp' }),
  )
  await facade.updateValues(values)
  // The adapter's payload type is the ATA-or-ATW union; this leg only
  // ever writes through the ATA facade.
  return defined(
    mock<HomeAtaValues>(defined(vi.mocked(api.updateValues).mock.lastCall?.[1]))
      .setTemperature,
  )
}

describeAtaSetpointClampContract('Classic ATA device', async (mode, value) =>
  classicClampWrite({ OperationMode: mode, SetTemperature: value }),
)

describeAtaSetpointClampContract('Home ATA device', async (mode, value) =>
  homeClampWrite({
    operationMode: operationModeFromClassic[mode],
    setTemperature: value,
  }),
)

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
