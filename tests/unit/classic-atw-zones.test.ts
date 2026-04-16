import { describe, expect, it } from 'vitest'

import type { ClassicListDeviceDataAtw } from '../../src/types/index.ts'
import {
  ClassicDeviceType,
  ClassicOperationModeState,
  ClassicOperationModeStateHotWater,
  ClassicOperationModeStateZone,
  ClassicOperationModeZone,
} from '../../src/constants.ts'
import { ClassicRegistry } from '../../src/entities/index.ts'
import {
  ClassicDeviceAtwFacade,
  ClassicDeviceAtwHasZone2Facade,
} from '../../src/facades/index.ts'
import { atwDevice, atwDeviceData, buildingData } from '../fixtures.ts'
import { assertDeviceType, createMockApi } from '../helpers.ts'

const createAtwData = (
  overrides: Partial<ClassicListDeviceDataAtw> = {},
): ClassicListDeviceDataAtw =>
  atwDeviceData({ OperationMode: ClassicOperationModeState.idle, ...overrides })

const mockApi = createMockApi()

const createAtwRegistry = (data: ClassicListDeviceDataAtw): ClassicRegistry => {
  const registry = new ClassicRegistry()
  registry.syncBuildings([
    buildingData({ HMDefined: true, Location: 0, TimeZone: 1 }),
  ])
  registry.syncDevices([
    atwDevice({
      AreaID: null,
      Device: data,
      FloorID: null,
    }),
  ])
  return registry
}

const createFacade = (
  data: ClassicListDeviceDataAtw = createAtwData(),
): ClassicDeviceAtwFacade => {
  const registry = createAtwRegistry(data)
  const device = registry.devices.getById(1001)
  assertDeviceType(device, ClassicDeviceType.Atw)
  return new ClassicDeviceAtwFacade(mockApi, registry, device)
}

const createZone2Facade = (
  data: ClassicListDeviceDataAtw = createAtwData({ HasZone2: true }),
): ClassicDeviceAtwHasZone2Facade => {
  const registry = createAtwRegistry(data)
  const device = registry.devices.getById(1001)
  assertDeviceType(device, ClassicDeviceType.Atw)
  return new ClassicDeviceAtwHasZone2Facade(mockApi, registry, device)
}

describe('atw device facade zone 1', () => {
  it('returns zone1 state', () => {
    const facade = createFacade()
    const { zone1 } = facade

    expect(zone1.operationMode).toBe(ClassicOperationModeZone.room)
    expect(zone1.roomTemperature).toBe(21)
    expect(zone1.setTemperature).toBe(22)
    expect(zone1.isIdle).toBe(false)
    expect(zone1.isInHeatMode).toBe(true)
    expect(zone1.isInCoolMode).toBe(false)
    expect(zone1.isHeatingProhibited).toBe(false)
    expect(zone1.isCoolingProhibited).toBe(false)
  })

  it('returns idle when device is idle', () => {
    const facade = createFacade(
      createAtwData({
        IdleZone1: true,
        OperationMode: ClassicOperationModeState.heating,
      }),
    )

    expect(facade.zone1.operationalState).toBe(
      ClassicOperationModeStateZone.idle,
    )
  })

  it('returns heating when device is heating and zone is not idle', () => {
    const facade = createFacade(
      createAtwData({ OperationMode: ClassicOperationModeState.heating }),
    )

    expect(facade.zone1.operationalState).toBe(
      ClassicOperationModeStateZone.heating,
    )
  })

  it('returns cooling when device is cooling and zone is not idle', () => {
    const facade = createFacade(
      createAtwData({
        OperationMode: ClassicOperationModeState.cooling,
        Zone1InCoolMode: true,
        Zone1InHeatMode: false,
      }),
    )

    expect(facade.zone1.operationalState).toBe(
      ClassicOperationModeStateZone.cooling,
    )
  })

  it('returns defrost when device is defrosting and zone is not idle', () => {
    const facade = createFacade(
      createAtwData({ OperationMode: ClassicOperationModeState.defrost }),
    )

    expect(facade.zone1.operationalState).toBe(
      ClassicOperationModeStateZone.defrost,
    )
  })

  it('returns prohibited when zone is in heat mode and heating is prohibited', () => {
    const facade = createFacade(
      createAtwData({
        OperationMode: ClassicOperationModeState.heating,
        ProhibitHeatingZone1: true,
        Zone1InHeatMode: true,
      }),
    )

    expect(facade.zone1.operationalState).toBe(
      ClassicOperationModeStateZone.prohibited,
    )
  })

  it('returns prohibited when zone is in cool mode and cooling is prohibited', () => {
    const facade = createFacade(
      createAtwData({
        OperationMode: ClassicOperationModeState.cooling,
        ProhibitCoolingZone1: true,
        Zone1InCoolMode: true,
      }),
    )

    expect(facade.zone1.operationalState).toBe(
      ClassicOperationModeStateZone.prohibited,
    )
  })

  it('returns idle when device is in DHW mode', () => {
    const facade = createFacade(
      createAtwData({ OperationMode: ClassicOperationModeState.dhw }),
    )

    expect(facade.zone1.operationalState).toBe(
      ClassicOperationModeStateZone.idle,
    )
  })
})

describe('atw device facade hot water', () => {
  it('returns hot water state', () => {
    const facade = createFacade()
    const { hotWater } = facade

    expect(hotWater.tankWaterTemperature).toBe(48)
    expect(hotWater.setTankWaterTemperature).toBe(50)
    expect(hotWater.maxTankTemperature).toBe(60)
    expect(hotWater.isEcoHotWater).toBe(false)
    expect(hotWater.isForcedMode).toBe(false)
    expect(hotWater.isProhibited).toBe(false)
  })

  it('returns idle when device is idle', () => {
    const facade = createFacade()

    expect(facade.hotWater.operationalState).toBe(
      ClassicOperationModeStateHotWater.idle,
    )
  })

  it('returns dhw when device is heating water', () => {
    const facade = createFacade(
      createAtwData({ OperationMode: ClassicOperationModeState.dhw }),
    )

    expect(facade.hotWater.operationalState).toBe(
      ClassicOperationModeStateHotWater.dhw,
    )
  })

  it('returns dhw when forced hot water mode is on', () => {
    const facade = createFacade(createAtwData({ ForcedHotWaterMode: true }))

    expect(facade.hotWater.operationalState).toBe(
      ClassicOperationModeStateHotWater.dhw,
    )
  })

  it('returns dhw when forced mode overrides heating state', () => {
    const facade = createFacade(
      createAtwData({
        ForcedHotWaterMode: true,
        OperationMode: ClassicOperationModeState.heating,
      }),
    )

    expect(facade.hotWater.operationalState).toBe(
      ClassicOperationModeStateHotWater.dhw,
    )
  })

  it('returns prohibited when hot water is prohibited', () => {
    const facade = createFacade(createAtwData({ ProhibitHotWater: true }))

    expect(facade.hotWater.operationalState).toBe(
      ClassicOperationModeStateHotWater.prohibited,
    )
  })

  it('returns legionella during legionella cycle', () => {
    const facade = createFacade(
      createAtwData({ OperationMode: ClassicOperationModeState.legionella }),
    )

    expect(facade.hotWater.operationalState).toBe(
      ClassicOperationModeStateHotWater.legionella,
    )
  })

  it('returns idle when device is heating zones', () => {
    const facade = createFacade(
      createAtwData({ OperationMode: ClassicOperationModeState.heating }),
    )

    expect(facade.hotWater.operationalState).toBe(
      ClassicOperationModeStateHotWater.idle,
    )
  })
})

describe('atw device facade zone 2', () => {
  it('returns zone2 state', () => {
    const facade = createZone2Facade()
    const { zone2 } = facade

    expect(zone2.operationMode).toBe(ClassicOperationModeZone.room)
    expect(zone2.roomTemperature).toBe(19)
    expect(zone2.setTemperature).toBe(20)
  })

  it('returns heating when device is heating and zone2 is not idle', () => {
    const facade = createZone2Facade(
      createAtwData({
        HasZone2: true,
        OperationMode: ClassicOperationModeState.heating,
        Zone2InHeatMode: true,
      }),
    )

    expect(facade.zone2.operationalState).toBe(
      ClassicOperationModeStateZone.heating,
    )
  })

  it('returns prohibited when zone2 heating is prohibited', () => {
    const facade = createZone2Facade(
      createAtwData({
        HasZone2: true,
        OperationMode: ClassicOperationModeState.heating,
        ProhibitHeatingZone2: true,
        Zone2InHeatMode: true,
      }),
    )

    expect(facade.zone2.operationalState).toBe(
      ClassicOperationModeStateZone.prohibited,
    )
  })

  it('also exposes zone1 and hotWater', () => {
    const facade = createZone2Facade()

    expect(facade.zone1.roomTemperature).toBe(21)
    expect(facade.hotWater.tankWaterTemperature).toBe(48)
  })
})
