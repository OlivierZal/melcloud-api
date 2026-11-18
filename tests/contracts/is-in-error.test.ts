import { defined } from '@olivierzal/api-core/testing'
import { beforeEach, describe, expect, it } from 'vitest'

import type { ClassicRegistry } from '../../src/entities/index.ts'
import type { FaultAware } from '../../src/entities/types.ts'
import { ClassicDeviceType } from '../../src/constants.ts'
import { ClassicDeviceAtaFacade } from '../../src/facades/classic-device-ata.ts'
import { HomeDeviceAtaFacade } from '../../src/facades/home-device-ata.ts'
import {
  assertClassicDeviceType,
  classicAreaData,
  classicAtaDevice,
  classicAtaDeviceData,
  classicBuildingData,
  classicFloorData,
  createMockClassicApi,
  populatedClassicRegistry,
} from '../classic-fixtures.ts'
import {
  createMockHomeApi,
  homeDevice,
  resetHomeDevices,
} from '../home-fixtures.ts'

// A unit's own fault reaches the two dialects differently — Classic lists
// a flag AND the sentence MELCloud gives it, Home a flag and the code
// alone (its `ErrorCode` setting) — and the contract is what a consumer
// may act on either way: the flag is the unit's, never the cloud's or this
// SDK's, and the wording is the dialect's own. A faulted unit stays
// reachable (`isAvailable`) and keeps answering writes (live-read
// 2026-11-06 on a unit in `E6`), which is why the flag has to be read on
// its own.
const FAULT = 'E6 : Elektrisk / kommunikasjons feil (E6) '

const CODE = 'E6'

const CASES: readonly {
  readonly isInError: boolean
  readonly label: string
}[] = [
  { isInError: false, label: 'a healthy unit' },
  { isInError: true, label: 'a faulted unit' },
]

/**
 * Runs the fault contract against one dialect.
 * @param name - Implementation label used in the test titles.
 * @param read - Builds a facade over a unit in the given fault state.
 * @param wording - What the dialect words a fault as.
 */
const describeFaultContract = (
  name: string,
  read: (isInError: boolean) => FaultAware,
  wording: string,
): void => {
  describe(`isInError — ${name}`, () => {
    beforeEach(resetHomeDevices)

    it.each(CASES)('reads $label as isInError=$isInError', ({ isInError }) => {
      expect(read(isInError).isInError).toBe(isInError)
    })

    it.each(CASES)('words $label as the dialect does', ({ isInError }) => {
      expect(read(isInError).errorMessage).toBe(isInError ? wording : null)
    })
  })
}

const classicRegistry = (): ClassicRegistry =>
  populatedClassicRegistry({
    areas: [classicAreaData()],
    buildings: [classicBuildingData()],
    floors: [classicFloorData()],
  })

describeFaultContract(
  'Classic device',
  (isInError) => {
    const registry = classicRegistry()
    const device = classicAtaDevice({
      Device: classicAtaDeviceData({
        ErrorCode: isInError ? 1_000_070 : 8000,
        // The wire pads its wording with a trailing space; the contract
        // hands the text out trimmed.
        ErrorMessages: isInError ? FAULT : '',
        HasError: isInError,
      }),
    })
    registry.syncDevices([device])
    const instance = defined(registry.devices.getById(device.DeviceID))
    assertClassicDeviceType(instance, ClassicDeviceType.Ata)
    return new ClassicDeviceAtaFacade(
      createMockClassicApi({ registry }),
      instance,
    )
  },
  FAULT.trim(),
)

// The healthy unit's setting is not trusted to be empty: the flag decides.
describeFaultContract(
  'Home device',
  (isInError) =>
    new HomeDeviceAtaFacade(
      createMockHomeApi(),
      homeDevice({
        id: `contract-fault-${String(isInError)}`,
        isInError,
        settings: { ErrorCode: ` ${CODE} `, IsInError: String(isInError) },
      }),
    ),
  CODE,
)

describe('errorMessage — Home device without a code', () => {
  beforeEach(resetHomeDevices)

  it('reads a faulted unit with no code as unworded', () => {
    const facade = new HomeDeviceAtaFacade(
      createMockHomeApi(),
      homeDevice({ id: 'contract-fault-uncoded', isInError: true }),
    )

    expect(facade.errorMessage).toBeNull()
  })
})
