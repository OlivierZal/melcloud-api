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
// a flag AND the wording MELCloud gives it, Home flags it alone — and the
// contract is what a consumer may act on either way: the flag is the
// unit's, never the cloud's or this SDK's, and the text is there when the
// dialect carries one. A faulted unit stays reachable (`isAvailable`) and
// keeps answering writes (live-read 2026-11-06 on a unit in `E6`), which
// is why the flag has to be read on its own.
const FAULT = 'E6 : Elektrisk / kommunikasjons feil (E6) '

const CASES: readonly {
  readonly errorMessage: string | null
  readonly isInError: boolean
  readonly label: string
}[] = [
  { errorMessage: null, isInError: false, label: 'a healthy unit' },
  { errorMessage: FAULT.trim(), isInError: true, label: 'a faulted unit' },
]

/**
 * Runs the fault contract against one dialect.
 * @param name - Implementation label used in the test titles.
 * @param read - Builds a facade over a unit in the given fault state.
 * @param hasWording - Whether the dialect carries the fault text.
 */
const describeFaultContract = (
  name: string,
  read: (isInError: boolean) => FaultAware,
  hasWording: boolean,
): void => {
  describe(`isInError — ${name}`, () => {
    beforeEach(resetHomeDevices)

    it.each(CASES)('reads $label as isInError=$isInError', ({ isInError }) => {
      expect(read(isInError).isInError).toBe(isInError)
    })

    it.each(CASES)(
      'words $label as the dialect does',
      ({ errorMessage, isInError }) => {
        expect(read(isInError).errorMessage).toBe(
          hasWording ? errorMessage : null,
        )
      },
    )
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
  true,
)

describeFaultContract(
  'Home device',
  (isInError) =>
    new HomeDeviceAtaFacade(
      createMockHomeApi(),
      homeDevice({ id: `contract-fault-${String(isInError)}`, isInError }),
    ),
  false,
)
