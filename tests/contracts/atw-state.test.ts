import { describe, expect, it } from 'vitest'

import type { AtwHotWaterState, AtwZoneState } from '../../src/atw-state.ts'
import {
  ClassicOperationModeState,
  ClassicOperationModeStateHotWater,
  ClassicOperationModeStateZone,
  HomeAtwOperationalState,
  HomeAtwZoneMode,
} from '../../src/constants.ts'
import { ClassicDeviceAtwFacade } from '../../src/facades/classic-device-atw.ts'
import { HomeDeviceAtwFacade } from '../../src/facades/home-device-atw.ts'
import { Temporal } from '../../src/temporal.ts'
import {
  classicAtwDevice,
  classicAtwDeviceData,
  classicBuildingData,
  createMockClassicApi,
  populatedClassicRegistry,
} from '../classic-fixtures.ts'
import { defined } from '../helpers.ts'
import { createMockHomeApi, homeAtwDevice } from '../home-fixtures.ts'

// One ATW state vocabulary on both dialects: the same top-level
// operational state, the same zone1/zone2/hotWater reads, the same
// string zone-mode vocabulary, the same derived operational states.
// What differs is precision — the Classic wire carries flag
// refinements the Home wire lacks — and that difference is typed
// (`null` = this wire cannot say), quarantined in the per-dialect
// describes below.
const describeAtwStateContract = (
  name: string,
  read: () => {
    hotWater: AtwHotWaterState
    operationalState: HomeAtwOperationalState | null
    zone1: AtwZoneState
    zone2: AtwZoneState | null
  },
): void => {
  describe(`atwState — ${name}`, () => {
    it('answers the shared snapshots in the shared vocabulary', () => {
      expect.assertions(6)

      const { hotWater, operationalState, zone1, zone2 } = read()

      // The device-level state both dialects derive from their own FTC
      // `OperationMode` spelling (Classic's numbers, Home's strings).
      expect(operationalState).toBe(HomeAtwOperationalState.heating)
      expect(zone1.operationMode).toBe(HomeAtwZoneMode.room)
      expect(zone1.operationalState).toBe(ClassicOperationModeStateZone.heating)
      expect(hotWater.operationalState).toBe(
        ClassicOperationModeStateHotWater.idle,
      )
      expect(hotWater.isProhibited).toBe(false)
      // A dual-zone unit answers a second snapshot; the shape is the
      // zone contract itself, so one clause covers it.
      expect(zone2?.operationMode).toBe(HomeAtwZoneMode.room)
    })
  })
}

describeAtwStateContract('Classic ATW device', () => {
  const registry = populatedClassicRegistry({
    buildings: [classicBuildingData()],
    devices: [
      classicAtwDevice({
        Device: classicAtwDeviceData({
          HasZone2: true,
          IdleZone1: false,
          OperationMode: ClassicOperationModeState.heating,
          Zone1InHeatMode: true,
        }),
      }),
    ],
  })
  const facade = new ClassicDeviceAtwFacade(
    createMockClassicApi(),
    registry,
    defined(registry.devices.getById(1001)),
  )
  return {
    hotWater: facade.hotWater,
    operationalState: facade.operationalState,
    zone1: facade.zone1,
    zone2: facade.zone2,
  }
})

describeAtwStateContract('Home ATW device', () => {
  const facade = new HomeDeviceAtwFacade(
    createMockHomeApi(),
    homeAtwDevice({
      capabilities: { hasZone2: true },
      id: 'contract-atw-state',
      settings: {
        OperationMode: 'Heating',
        OperationModeZone1: 'HeatRoomTemperature',
        OperationModeZone2: 'HeatRoomTemperature',
        ProhibitHotWater: 'False',
      },
    }),
  )
  return {
    hotWater: facade.hotWater,
    operationalState: facade.operationalState,
    zone1: facade.zone1,
    zone2: facade.zone2,
  }
})

// Only Classic can express these: the wire flag refinements.
describe('atwState — Classic flag precision', () => {
  it('keeps the flags boolean and can answer prohibited', () => {
    const registry = populatedClassicRegistry({
      buildings: [classicBuildingData()],
      devices: [
        classicAtwDevice({
          Device: classicAtwDeviceData({
            OperationMode: ClassicOperationModeState.heating,
            ProhibitHeatingZone1: true,
            Zone1InHeatMode: true,
          }),
        }),
      ],
    })
    const facade = new ClassicDeviceAtwFacade(
      createMockClassicApi(),
      registry,
      defined(registry.devices.getById(1001)),
    )

    expect(facade.zone1.isInHeatMode).toBe(true)
    expect(facade.zone1.operationalState).toBe(
      ClassicOperationModeStateZone.prohibited,
    )
    expect(facade.zone2).toBeNull()
  })
})

// Only Home needs these: the wire has no flag refinements and no
// last-legionella stamp, so the nullable fields say so instead of
// inventing values.
describe('atwState — Home null precision', () => {
  it('reads null for every flag the wire cannot say', () => {
    const facade = new HomeDeviceAtwFacade(
      createMockHomeApi(),
      homeAtwDevice({ id: 'contract-atw-nulls' }),
    )

    expect(facade.zone1.isIdle).toBeNull()
    expect(facade.zone1.isCoolingProhibited).toBeNull()
    expect(facade.hotWater.isEcoHotWater).toBeNull()
    expect(facade.hotWater.lastLegionellaActivationEpochMs).toBeNull()
    expect(facade.hotWater.maxTankTemperature).toBeNull()
    expect(facade.zone2).toBeNull()
  })
})

const facadeWithLegionellaStamp = (
  lastLegionellaActivationTime: string,
): ClassicDeviceAtwFacade => {
  const registry = populatedClassicRegistry({
    buildings: [classicBuildingData()],
    devices: [
      classicAtwDevice({
        Device: classicAtwDeviceData({
          LastLegionellaActivationTime: lastLegionellaActivationTime,
        }),
      }),
    ],
  })
  return new ClassicDeviceAtwFacade(
    createMockClassicApi({ timezone: 'Europe/Paris' }),
    registry,
    defined(registry.devices.getById(1001)),
  )
}

// Only Classic can say when legionella prevention last ran, and its
// wire speaks building-local wall clock like every Classic timestamp:
// the stamp anchors in the client's configured timezone, and the year-1
// "never ran" sentinel — or a value the wire garbled — reads null, the
// same nothing the Home wire answers.
describe('atwState — Classic legionella stamp', () => {
  it('anchors the building-local stamp in the configured timezone', () => {
    // Paris winter wall clock (UTC+1): 06:00 locally is 05:00Z — a
    // projection that drops the zone cannot pass.
    expect(
      facadeWithLegionellaStamp('2026-03-01T06:00:00').hotWater
        .lastLegionellaActivationEpochMs,
    ).toBe(Temporal.Instant.from('2026-03-01T05:00:00Z').epochMilliseconds)
  })

  it('reads the year-1 sentinel as null, not as an ancient instant', () => {
    expect(
      facadeWithLegionellaStamp('0001-01-01T00:00:00').hotWater
        .lastLegionellaActivationEpochMs,
    ).toBeNull()
  })

  it('reads an unparseable stamp as null rather than failing the snapshot', () => {
    expect(
      facadeWithLegionellaStamp('').hotWater.lastLegionellaActivationEpochMs,
    ).toBeNull()
  })
})
