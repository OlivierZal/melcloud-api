import { DeviceType, LabelType, OperationModeZone } from '../src/constants.ts'
import {
  type AreaDataAny,
  type BuildingData,
  type FloorData,
  type ListDevice,
  type ListDeviceAny,
  type ListDeviceDataAta,
  type ListDeviceDataAtw,
  type ListDeviceDataErv,
  type ReportData,
  toAreaId,
  toBuildingId,
  toDeviceId,
  toFloorId,
} from '../src/types/index.ts'
import { mock } from './helpers.ts'

/*
 * ---------------------------------------------------------------------------
 * Primitive model data factories
 * ---------------------------------------------------------------------------
 */

export const buildingData = (
  overrides: Partial<BuildingData> = {},
): BuildingData => ({
  FPDefined: true,
  FPEnabled: false,
  FPMaxTemperature: 16,
  FPMinTemperature: 4,
  HMDefined: false,
  HMEnabled: false,
  HMEndDate: null,
  HMStartDate: null,
  ID: toBuildingId(1),
  Location: 10,
  Name: 'Building',
  TimeZone: 0,
  ...overrides,
})

export const floorData = (overrides: Partial<FloorData> = {}): FloorData => ({
  BuildingId: toBuildingId(1),
  ID: 10,
  Name: 'Floor',
  ...overrides,
})

export const areaData = (
  overrides: Partial<AreaDataAny> = {},
): AreaDataAny => ({
  BuildingId: toBuildingId(1),
  FloorId: 10,
  ID: 100,
  Name: 'Area',
  ...overrides,
})

/*
 * ---------------------------------------------------------------------------
 * Device data factories (inner `Device` payloads)
 * ---------------------------------------------------------------------------
 */

export const ataDeviceData = (
  overrides: Partial<ListDeviceDataAta> = {},
): ListDeviceDataAta =>
  mock<ListDeviceDataAta>({
    ActualFanSpeed: 3,
    EffectiveFlags: 0,
    FanSpeed: 3,
    HasAutomaticFanSpeed: true,
    MaxTempAutomatic: 31,
    MaxTempCoolDry: 31,
    MaxTempHeat: 31,
    MinTempAutomatic: 16,
    MinTempCoolDry: 16,
    MinTempHeat: 10,
    Offline: false,
    OperationMode: 1,
    OutdoorTemperature: 20,
    Power: true,
    RoomTemperature: 22,
    SetTemperature: 24,
    VaneHorizontalDirection: 0,
    VaneVerticalDirection: 0,
    WifiSignalStrength: -50,
    ...overrides,
  })

const atwDefaults: Partial<ListDeviceDataAtw> = {
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
}

export const atwDeviceData = (
  overrides: Partial<ListDeviceDataAtw> = {},
): ListDeviceDataAtw =>
  mock<ListDeviceDataAtw>({ ...atwDefaults, ...overrides })

export const ervDeviceData = (
  overrides: Partial<ListDeviceDataErv> = {},
): ListDeviceDataErv =>
  mock<ListDeviceDataErv>({
    EffectiveFlags: 0,
    HasAutomaticFanSpeed: true,
    HasCO2Sensor: false,
    HasPM25Sensor: false,
    Offline: false,
    PM25Level: 0,
    Power: true,
    SetFanSpeed: 3,
    VentilationMode: 0,
    WifiSignalStrength: -50,
    ...overrides,
  })

/*
 * ---------------------------------------------------------------------------
 * Default fixture IDs — named constants so the numeric literals don't
 * trigger `@typescript-eslint/no-magic-numbers` outside the vitest
 * override (this file is a helper, not a `.test.ts`).
 * ---------------------------------------------------------------------------
 */

const DEFAULT_AREA_ID = toAreaId(100)
const DEFAULT_BUILDING_ID = toBuildingId(1)
const DEFAULT_FLOOR_ID = toFloorId(10)
const DEFAULT_ATA_DEVICE_ID = toDeviceId(1000)
const DEFAULT_ATW_DEVICE_ID = toDeviceId(1001)
const DEFAULT_ERV_DEVICE_ID = toDeviceId(1002)

/*
 * ---------------------------------------------------------------------------
 * Full list-device wrappers (envelope around device data)
 * ---------------------------------------------------------------------------
 */

export const ataDevice = (
  overrides: Partial<ListDevice<typeof DeviceType.Ata>> = {},
): ListDeviceAny => ({
  AreaID: DEFAULT_AREA_ID,
  BuildingID: DEFAULT_BUILDING_ID,
  Device: ataDeviceData(),
  DeviceID: DEFAULT_ATA_DEVICE_ID,
  DeviceName: 'ATA Device',
  FloorID: DEFAULT_FLOOR_ID,
  Type: DeviceType.Ata,
  ...overrides,
})

export const atwDevice = (
  overrides: Partial<ListDevice<typeof DeviceType.Atw>> = {},
): ListDeviceAny => ({
  AreaID: DEFAULT_AREA_ID,
  BuildingID: DEFAULT_BUILDING_ID,
  Device: atwDeviceData(),
  DeviceID: DEFAULT_ATW_DEVICE_ID,
  DeviceName: 'ATW Device',
  FloorID: DEFAULT_FLOOR_ID,
  Type: DeviceType.Atw,
  ...overrides,
})

export const ervDevice = (
  overrides: Partial<ListDevice<typeof DeviceType.Erv>> = {},
): ListDeviceAny => ({
  AreaID: DEFAULT_AREA_ID,
  BuildingID: DEFAULT_BUILDING_ID,
  Device: ervDeviceData(),
  DeviceID: DEFAULT_ERV_DEVICE_ID,
  DeviceName: 'ERV Device',
  FloorID: null,
  Type: DeviceType.Erv,
  ...overrides,
})

/*
 * ---------------------------------------------------------------------------
 * API response fixtures
 * ---------------------------------------------------------------------------
 */

export const reportData = (
  overrides: Partial<ReportData> = {},
): ReportData => ({
  Data: [[1]],
  FromDate: '2024-01-01',
  Labels: ['a'],
  LabelType: LabelType.raw,
  Points: 1,
  Series: 1,
  ToDate: '2024-01-01',
  ...overrides,
})

export const holidayModeResponse = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  EndDate: { Day: 1, Hour: 0, Minute: 0, Month: 1, Second: 0, Year: 2024 },
  HMDefined: false,
  HMEnabled: false,
  HMEndDate: null,
  HMStartDate: null,
  StartDate: { Day: 1, Hour: 0, Minute: 0, Month: 1, Second: 0, Year: 2024 },
  TimeZone: 0,
  ...overrides,
})

export const frostProtectionResponse = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  FPDefined: false,
  FPEnabled: false,
  FPMaxTemperature: 16,
  FPMinTemperature: 4,
  ...overrides,
})
