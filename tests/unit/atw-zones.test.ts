import { describe, expect, it, vi } from 'vitest'

import type { APIAdapter } from '../../src/services/index.ts'
import type {
  BuildingData,
  ListDeviceAny,
  ListDeviceDataAtw,
} from '../../src/types/index.ts'

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
import { assertDeviceType, mock } from '../helpers.ts'

const buildingData: BuildingData = {
  FPDefined: true,
  FPEnabled: false,
  FPMaxTemperature: 16,
  FPMinTemperature: 4,
  HMDefined: true,
  HMEnabled: false,
  HMEndDate: null,
  HMStartDate: null,
  ID: 1,
  Location: 0,
  Name: 'Building',
  TimeZone: 1,
}

const createAtwData = (
  overrides: Partial<ListDeviceDataAtw> = {},
): ListDeviceDataAtw =>
  mock<ListDeviceDataAtw>({
    BoosterHeater1Status: false,
    BoosterHeater2PlusStatus: false,
    BoosterHeater2Status: false,
    CanCool: true,
    CondensingTemperature: 40,
    CurrentEnergyConsumed: 0,
    CurrentEnergyProduced: 0,
    DefrostMode: 0,
    EcoHotWater: false,
    EffectiveFlags: 0,
    FlowTemperature: 35,
    FlowTemperatureZone1: 35,
    FlowTemperatureZone2: 35,
    ForcedHotWaterMode: false,
    HasZone2: false,
    HeatPumpFrequency: 50,
    IdleZone1: false,
    IdleZone2: false,
    ImmersionHeaterStatus: false,
    LastLegionellaActivationTime: '',
    MaxTankTemperature: 60,
    MixingTankWaterTemperature: 0,
    Offline: false,
    OperationMode: OperationModeState.idle,
    OperationModeZone1: OperationModeZone.room,
    OperationModeZone2: OperationModeZone.room,
    Power: true,
    ProhibitCoolingZone1: false,
    ProhibitCoolingZone2: false,
    ProhibitHeatingZone1: false,
    ProhibitHeatingZone2: false,
    ProhibitHotWater: false,
    ReturnTemperature: 30,
    ReturnTemperatureZone1: 30,
    ReturnTemperatureZone2: 30,
    RoomTemperatureZone1: 21,
    RoomTemperatureZone2: 19,
    SetCoolFlowTemperatureZone1: 20,
    SetCoolFlowTemperatureZone2: 20,
    SetHeatFlowTemperatureZone1: 40,
    SetHeatFlowTemperatureZone2: 40,
    SetTankWaterTemperature: 50,
    SetTemperatureZone1: 22,
    SetTemperatureZone2: 20,
    TankWaterTemperature: 48,
    TargetHCTemperatureZone1: 22,
    TargetHCTemperatureZone2: 22,
    WifiSignalStrength: -50,
    Zone1InCoolMode: false,
    Zone1InHeatMode: true,
    Zone2InCoolMode: false,
    Zone2InHeatMode: false,
    ...overrides,
  })

const createDevice = (
  data: ListDeviceDataAtw = createAtwData(),
): ListDeviceAny => ({
  AreaID: null,
  BuildingID: 1,
  Device: data,
  DeviceID: 1001,
  DeviceName: 'ATW Device',
  FloorID: null,
  Type: DeviceType.Atw,
})

const mockApi = mock<APIAdapter>({
  fetch: vi.fn().mockResolvedValue([]),
  onSync: vi.fn().mockImplementation(async () => {}),
})

const createFacade = (
  data: ListDeviceDataAtw = createAtwData(),
): DeviceAtwFacade => {
  const registry = new ModelRegistry()
  registry.syncBuildings([buildingData])
  registry.syncDevices([createDevice(data)])
  const device = registry.devices.getById(1001)
  assertDeviceType(device, DeviceType.Atw)
  return new DeviceAtwFacade(mockApi, registry, device)
}

const createZone2Facade = (
  data: ListDeviceDataAtw = createAtwData({ HasZone2: true }),
): DeviceAtwHasZone2Facade => {
  const registry = new ModelRegistry()
  registry.syncBuildings([buildingData])
  registry.syncDevices([createDevice(data)])
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
