import { describe, expect, it, vi } from 'vitest'

import type { HomeAPIAdapter } from '../../src/api/home-types.ts'
import { ClassicDeviceType } from '../../src/constants.ts'
import { ClassicRegistry } from '../../src/entities/index.ts'
import { EntityNotFoundError } from '../../src/errors/index.ts'
import { ClassicDeviceAtaFacade } from '../../src/facades/classic-device-ata.ts'
import { HomeDeviceAtaFacade } from '../../src/facades/home-device-ata.ts'
import { Temporal } from '../../src/temporal.ts'
import {
  assertClassicDeviceType,
  classicAreaData,
  classicAtaDevice,
  classicAtaDeviceData,
  classicBuildingData,
  classicFloorData,
  createMockClassicApi,
} from '../classic-fixtures.ts'
import { cast, defined, mock } from '../helpers.ts'
import { homeDevice, homeTestRegistry } from '../home-fixtures.ts'

// `isAvailable` answers one question on both dialects — has this unit
// gone quiet for longer than the stale window? — from two different
// sources: Classic reads a last-communication timestamp, Home a
// disconnection streak. That difference is real and is not the contract;
// what follows is.
//
// The clauses live here once because the dialects diverging on one of
// them is not hypothetical: 45.0.1 fixed Classic reading a pruned id as
// reachable where Home already threw, with both at 100% coverage and
// nothing asking them the same question.
const CASES: readonly {
  readonly isAvailable: boolean
  readonly label: string
  readonly silentHours: number
}[] = [
  { isAvailable: true, label: 'heard from just now', silentHours: 0 },
  { isAvailable: true, label: 'quiet for an hour', silentHours: 1 },
  { isAvailable: false, label: 'quiet for over a day', silentHours: 25 },
]

/**
 * Runs the `isAvailable` contract against one dialect.
 * @param name - Implementation label used in the test titles.
 * @param read - Reads availability for a unit quiet that many hours.
 * @param readPruned - Reads availability once the registry has dropped
 * the id, which must throw rather than answer.
 */
const describeIsAvailableContract = (
  name: string,
  read: (silentHours: number) => boolean,
  readPruned: () => boolean,
): void => {
  describe(`isAvailable — ${name}`, () => {
    it.each(CASES)(
      'reads a unit $label as isAvailable=$isAvailable',
      ({ isAvailable, silentHours }) => {
        expect(read(silentHours)).toBe(isAvailable)
      },
    )

    it('propagates a pruned id instead of reading available', () => {
      expect(readPruned).toThrow(EntityNotFoundError)
    })
  })
}

const now = (): Temporal.PlainDateTime => Temporal.Now.plainDateTimeISO('UTC')

const classicRegistry = (): ClassicRegistry => {
  const registry = new ClassicRegistry()
  registry.syncBuildings([classicBuildingData()])
  registry.syncFloors([classicFloorData()])
  registry.syncAreas([classicAreaData()])
  return registry
}

const classicFacade = (
  registry: ClassicRegistry,
  device = classicAtaDevice(),
): ClassicDeviceAtaFacade => {
  registry.syncDevices([device])
  const instance = defined(registry.devices.getById(device.DeviceID))
  assertClassicDeviceType(instance, ClassicDeviceType.Ata)
  return new ClassicDeviceAtaFacade(createMockClassicApi(), registry, instance)
}

describeIsAvailableContract(
  'Classic device',
  (silentHours) =>
    classicFacade(
      classicRegistry(),
      classicAtaDevice({
        Device: classicAtaDeviceData({
          LastTimeStamp: now().subtract({ hours: silentHours }).toString(),
        }),
      }),
    ).isAvailable,
  () => {
    const registry = classicRegistry()
    const facade = classicFacade(registry)
    registry.syncDevices([])
    return facade.isAvailable
  },
)

const homeApi = (): HomeAPIAdapter =>
  mock<HomeAPIAdapter>({ registry: cast(homeTestRegistry) })

// Home expresses silence as a disconnection streak, so the clock is
// moved rather than the payload; `isConnected` stays true for a unit
// heard from just now.
describeIsAvailableContract(
  'Home device',
  (silentHours) => {
    const facade = new HomeDeviceAtaFacade(
      homeApi(),
      homeDevice({
        id: `contract-available-${String(silentHours)}`,
        isConnected: silentHours === 0,
      }),
    )
    if (silentHours === 0) {
      return facade.isAvailable
    }
    const later = now().add({ hours: silentHours })
    const spy = vi
      .spyOn(Temporal.Now, 'plainDateTimeISO')
      .mockReturnValue(later)
    try {
      return facade.isAvailable
    } finally {
      spy.mockRestore()
    }
  },
  () => {
    const facade = new HomeDeviceAtaFacade(
      homeApi(),
      homeDevice({ id: 'contract-available-pruned' }),
    )
    homeTestRegistry.delete('contract-available-pruned')
    return facade.isAvailable
  },
)
