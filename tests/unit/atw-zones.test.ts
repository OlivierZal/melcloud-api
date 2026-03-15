import { describe, expect, it, vi } from 'vitest'

import type { APIAdapter } from '../../src/services/index.ts'
import type { ListDeviceDataAtw } from '../../src/types/index.ts'

import {
  DeviceType,
  OperationModeState,
  OperationModeStateHotWater,
  OperationModeStateZone,
  OperationModeZone,
} from '../../src/constants.ts'
import { DeviceAtwHasZone2Facade } from '../../src/facades/device-atw-has-zone2.ts'
import { DeviceAtwFacade } from '../../src/facades/device-atw.ts'
import { ModelRegistry } from '../../src/models/index.ts'
import { atwDevice, atwDeviceData, buildingData } from '../fixtures.ts'
import { assertDeviceType, mock } from '../helpers.ts'

const createAtwData = (
  overrides: Partial<ListDeviceDataAtw> = {},
): ListDeviceDataAtw =>
  atwDeviceData({ OperationMode: OperationModeState.idle, ...overrides })

const mockApi = mock<APIAdapter>({
  fetch: vi.fn().mockResolvedValue([]),
  onSync: vi.fn().mockImplementation(async () => {}),
})

const createFacade = (
  data: ListDeviceDataAtw = createAtwData(),
): DeviceAtwFacade => {
  const registry = new ModelRegistry()
  registry.syncBuildings([
    buildingData({ HMDefined: true, Location: 0, TimeZone: 1 }),
  ])
  registry.syncDevices([
    atwDevice({ AreaID: null, Device: data, FloorID: null }),
  ])
  const device = registry.devices.getById(1001)
  assertDeviceType(device, DeviceType.Atw)
  return new DeviceAtwFacade(mockApi, registry, device)
}

const createZone2Facade = (
  data: ListDeviceDataAtw = createAtwData({ HasZone2: true }),
): DeviceAtwHasZone2Facade => {
  const registry = new ModelRegistry()
  registry.syncBuildings([
    buildingData({ HMDefined: true, Location: 0, TimeZone: 1 }),
  ])
  registry.syncDevices([
    atwDevice({ AreaID: null, Device: data, FloorID: null }),
  ])
  const device = registry.devices.getById(1001)
  assertDeviceType(device, DeviceType.Atw)
  return new DeviceAtwHasZone2Facade(mockApi, registry, device)
}

describe('deviceAtwFacade zone1', () => {
  it('returns zone1 state', () => {
    const facade = createFacade()
    const { zone1 } = facade

    expect(zone1.operationMode).toBe(OperationModeZone.room)
    expect(zone1.roomTemperature).toBe(21)
    expect(zone1.setTemperature).toBe(22)
    expect(zone1.idle).toBe(false)
    expect(zone1.inHeatMode).toBe(true)
    expect(zone1.inCoolMode).toBe(false)
    expect(zone1.prohibitHeating).toBe(false)
    expect(zone1.prohibitCooling).toBe(false)
  })

  it('returns idle when device is idle', () => {
    const facade = createFacade(
      createAtwData({
        IdleZone1: true,
        OperationMode: OperationModeState.heating,
      }),
    )

    expect(facade.zone1.operationalState).toBe(OperationModeStateZone.idle)
  })

  it('returns heating when device is heating and zone is not idle', () => {
    const facade = createFacade(
      createAtwData({ OperationMode: OperationModeState.heating }),
    )

    expect(facade.zone1.operationalState).toBe(OperationModeStateZone.heating)
  })

  it('returns cooling when device is cooling and zone is not idle', () => {
    const facade = createFacade(
      createAtwData({
        OperationMode: OperationModeState.cooling,
        Zone1InCoolMode: true,
        Zone1InHeatMode: false,
      }),
    )

    expect(facade.zone1.operationalState).toBe(OperationModeStateZone.cooling)
  })

  it('returns defrost when device is defrosting and zone is not idle', () => {
    const facade = createFacade(
      createAtwData({ OperationMode: OperationModeState.defrost }),
    )

    expect(facade.zone1.operationalState).toBe(OperationModeStateZone.defrost)
  })

  it('returns prohibited when zone is in heat mode and heating is prohibited', () => {
    const facade = createFacade(
      createAtwData({
        OperationMode: OperationModeState.heating,
        ProhibitHeatingZone1: true,
        Zone1InHeatMode: true,
      }),
    )

    expect(facade.zone1.operationalState).toBe(
      OperationModeStateZone.prohibited,
    )
  })

  it('returns prohibited when zone is in cool mode and cooling is prohibited', () => {
    const facade = createFacade(
      createAtwData({
        OperationMode: OperationModeState.cooling,
        ProhibitCoolingZone1: true,
        Zone1InCoolMode: true,
      }),
    )

    expect(facade.zone1.operationalState).toBe(
      OperationModeStateZone.prohibited,
    )
  })

  it('returns idle when device is in DHW mode', () => {
    const facade = createFacade(
      createAtwData({ OperationMode: OperationModeState.dhw }),
    )

    expect(facade.zone1.operationalState).toBe(OperationModeStateZone.idle)
  })
})

describe('deviceAtwFacade hotWater', () => {
  it('returns hot water state', () => {
    const facade = createFacade()
    const { hotWater } = facade

    expect(hotWater.tankWaterTemperature).toBe(48)
    expect(hotWater.setTankWaterTemperature).toBe(50)
    expect(hotWater.maxTankTemperature).toBe(60)
    expect(hotWater.ecoHotWater).toBe(false)
    expect(hotWater.forcedMode).toBe(false)
    expect(hotWater.prohibited).toBe(false)
  })

  it('returns idle when device is idle', () => {
    const facade = createFacade()

    expect(facade.hotWater.operationalState).toBe(
      OperationModeStateHotWater.idle,
    )
  })

  it('returns dhw when device is heating water', () => {
    const facade = createFacade(
      createAtwData({ OperationMode: OperationModeState.dhw }),
    )

    expect(facade.hotWater.operationalState).toBe(
      OperationModeStateHotWater.dhw,
    )
  })

  it('returns dhw when forced hot water mode is on', () => {
    const facade = createFacade(createAtwData({ ForcedHotWaterMode: true }))

    expect(facade.hotWater.operationalState).toBe(
      OperationModeStateHotWater.dhw,
    )
  })

  it('returns dhw when forced mode overrides heating state', () => {
    const facade = createFacade(
      createAtwData({
        ForcedHotWaterMode: true,
        OperationMode: OperationModeState.heating,
      }),
    )

    expect(facade.hotWater.operationalState).toBe(
      OperationModeStateHotWater.dhw,
    )
  })

  it('returns prohibited when hot water is prohibited', () => {
    const facade = createFacade(createAtwData({ ProhibitHotWater: true }))

    expect(facade.hotWater.operationalState).toBe(
      OperationModeStateHotWater.prohibited,
    )
  })

  it('returns legionella during legionella cycle', () => {
    const facade = createFacade(
      createAtwData({ OperationMode: OperationModeState.legionella }),
    )

    expect(facade.hotWater.operationalState).toBe(
      OperationModeStateHotWater.legionella,
    )
  })

  it('returns idle when device is heating zones', () => {
    const facade = createFacade(
      createAtwData({ OperationMode: OperationModeState.heating }),
    )

    expect(facade.hotWater.operationalState).toBe(
      OperationModeStateHotWater.idle,
    )
  })
})

describe('deviceAtwHasZone2Facade zone2', () => {
  it('returns zone2 state', () => {
    const facade = createZone2Facade()
    const { zone2 } = facade

    expect(zone2.operationMode).toBe(OperationModeZone.room)
    expect(zone2.roomTemperature).toBe(19)
    expect(zone2.setTemperature).toBe(20)
  })

  it('returns heating when device is heating and zone2 is not idle', () => {
    const facade = createZone2Facade(
      createAtwData({
        HasZone2: true,
        OperationMode: OperationModeState.heating,
        Zone2InHeatMode: true,
      }),
    )

    expect(facade.zone2.operationalState).toBe(OperationModeStateZone.heating)
  })

  it('returns prohibited when zone2 heating is prohibited', () => {
    const facade = createZone2Facade(
      createAtwData({
        HasZone2: true,
        OperationMode: OperationModeState.heating,
        ProhibitHeatingZone2: true,
        Zone2InHeatMode: true,
      }),
    )

    expect(facade.zone2.operationalState).toBe(
      OperationModeStateZone.prohibited,
    )
  })

  it('also exposes zone1 and hotWater', () => {
    const facade = createZone2Facade()

    expect(facade.zone1.roomTemperature).toBe(21)
    expect(facade.hotWater.tankWaterTemperature).toBe(48)
  })
})
