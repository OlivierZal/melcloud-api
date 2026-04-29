import {
  ClassicDeviceType,
  ClassicLabelType,
  ClassicOperationModeZone,
} from '../src/constants.ts'
import {
  type ClassicAreaDataAny,
  type ClassicBuildingData,
  type ClassicBuildingWithStructure,
  type ClassicFloorData,
  type ClassicFrostProtectionData,
  type ClassicHolidayModeData,
  type ClassicListDevice,
  type ClassicListDeviceAny,
  type ClassicListDeviceDataAta,
  type ClassicListDeviceDataAtw,
  type ClassicListDeviceDataErv,
  type ClassicReportData,
  toClassicAreaId,
  toClassicBuildingId,
  toClassicDeviceId,
  toClassicFloorId,
} from '../src/types/index.ts'
import { cast, mock } from './helpers.ts'

// ---------------------------------------------------------------------------
// Primitive model data factories
// ---------------------------------------------------------------------------

export const classicBuildingData = (
  overrides: Partial<ClassicBuildingData> = {},
): ClassicBuildingData => ({
  FPDefined: true,
  FPEnabled: false,
  FPMaxTemperature: 16,
  FPMinTemperature: 4,
  HMDefined: false,
  HMEnabled: false,
  HMEndDate: null,
  HMStartDate: null,
  ID: toClassicBuildingId(1),
  Location: 10,
  Name: 'ClassicBuilding',
  TimeZone: 0,
  ...overrides,
})

export const classicFloorData = (
  overrides: Partial<ClassicFloorData> = {},
): ClassicFloorData => ({
  BuildingId: toClassicBuildingId(1),
  ID: 10,
  Name: 'ClassicFloor',
  ...overrides,
})

export const classicAreaData = (
  overrides: Partial<ClassicAreaDataAny> = {},
): ClassicAreaDataAny => ({
  BuildingId: toClassicBuildingId(1),
  FloorId: 10,
  ID: 100,
  Name: 'ClassicArea',
  ...overrides,
})

// ---------------------------------------------------------------------------
// ClassicDevice data factories (inner `ClassicDevice` payloads)
// ---------------------------------------------------------------------------

export const classicAtaDeviceData = (
  overrides: Partial<ClassicListDeviceDataAta> = {},
): ClassicListDeviceDataAta =>
  mock<ClassicListDeviceDataAta>({
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

const classicAtwDefaults: Partial<ClassicListDeviceDataAtw> = {
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
  OperationModeZone1: ClassicOperationModeZone.room,
  OperationModeZone2: ClassicOperationModeZone.room,
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

export const classicAtwDeviceData = (
  overrides: Partial<ClassicListDeviceDataAtw> = {},
): ClassicListDeviceDataAtw =>
  mock<ClassicListDeviceDataAtw>({ ...classicAtwDefaults, ...overrides })

export const classicErvDeviceData = (
  overrides: Partial<ClassicListDeviceDataErv> = {},
): ClassicListDeviceDataErv =>
  mock<ClassicListDeviceDataErv>({
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

// ---------------------------------------------------------------------------
// Default fixture IDs — named constants so the numeric literals don't
// trigger `@typescript-eslint/no-magic-numbers` outside the vitest
// override (this file is a helper, not a `.test.ts`).
// ---------------------------------------------------------------------------

const DEFAULT_AREA_ID = toClassicAreaId(100)
const DEFAULT_BUILDING_ID = toClassicBuildingId(1)
const DEFAULT_FLOOR_ID = toClassicFloorId(10)
const DEFAULT_ATA_DEVICE_ID = toClassicDeviceId(1000)
const DEFAULT_ATW_DEVICE_ID = toClassicDeviceId(1001)
const DEFAULT_ERV_DEVICE_ID = toClassicDeviceId(1002)

// ---------------------------------------------------------------------------
// Full list-device wrappers (envelope around device data)
// ---------------------------------------------------------------------------

export const classicAtaDevice = (
  overrides: Partial<ClassicListDevice<typeof ClassicDeviceType.Ata>> = {},
): ClassicListDeviceAny => ({
  AreaID: DEFAULT_AREA_ID,
  BuildingID: DEFAULT_BUILDING_ID,
  Device: classicAtaDeviceData(),
  DeviceID: DEFAULT_ATA_DEVICE_ID,
  DeviceName: 'ATA ClassicDevice',
  FloorID: DEFAULT_FLOOR_ID,
  Type: ClassicDeviceType.Ata,
  ...overrides,
})

export const classicAtwDevice = (
  overrides: Partial<ClassicListDevice<typeof ClassicDeviceType.Atw>> = {},
): ClassicListDeviceAny => ({
  AreaID: DEFAULT_AREA_ID,
  BuildingID: DEFAULT_BUILDING_ID,
  Device: classicAtwDeviceData(),
  DeviceID: DEFAULT_ATW_DEVICE_ID,
  DeviceName: 'ATW ClassicDevice',
  FloorID: DEFAULT_FLOOR_ID,
  Type: ClassicDeviceType.Atw,
  ...overrides,
})

export const classicErvDevice = (
  overrides: Partial<ClassicListDevice<typeof ClassicDeviceType.Erv>> = {},
): ClassicListDeviceAny => ({
  AreaID: DEFAULT_AREA_ID,
  BuildingID: DEFAULT_BUILDING_ID,
  Device: classicErvDeviceData(),
  DeviceID: DEFAULT_ERV_DEVICE_ID,
  DeviceName: 'ERV ClassicDevice',
  FloorID: null,
  Type: ClassicDeviceType.Erv,
  ...overrides,
})

// ---------------------------------------------------------------------------
// API response fixtures
// ---------------------------------------------------------------------------

export const classicReportData = (
  overrides: Partial<ClassicReportData> = {},
): ClassicReportData => ({
  Data: [[1]],
  FromDate: '2024-01-01',
  Labels: ['a'],
  LabelType: ClassicLabelType.raw,
  Points: 1,
  Series: 1,
  ToDate: '2024-01-01',
  ...overrides,
})

export const classicHolidayModeResponse = (
  overrides: Partial<ClassicHolidayModeData> = {},
): ClassicHolidayModeData => ({
  EndDate: { Day: 1, Hour: 0, Minute: 0, Month: 1, Second: 0, Year: 2024 },
  HMDefined: false,
  HMEnabled: false,
  HMEndDate: null,
  HMStartDate: null,
  StartDate: { Day: 1, Hour: 0, Minute: 0, Month: 1, Second: 0, Year: 2024 },
  TimeZone: 0,
  ...overrides,
})

export const classicFrostProtectionResponse = (
  overrides: Partial<ClassicFrostProtectionData> = {},
): ClassicFrostProtectionData => ({
  FPDefined: false,
  FPEnabled: false,
  FPMaxTemperature: 16,
  FPMinTemperature: 4,
  ...overrides,
})

// ---------------------------------------------------------------------------
// Permissive raw factories — accept arbitrary overrides via `cast`. Used by
// API-level tests that exercise unbranded ID inputs and minimal device
// payloads where the typed envelope above is too strict.
// ---------------------------------------------------------------------------

export const classicBuildingWithStructure = (
  overrides: Partial<ClassicBuildingWithStructure> = {},
): ClassicBuildingWithStructure =>
  mock<ClassicBuildingWithStructure>({
    ...classicBuildingData(),
    Structure: { Areas: [], Devices: [], Floors: [] },
    ...overrides,
  })

export const classicRawDevice = (
  overrides: Record<string, unknown> = {},
): ClassicListDeviceAny =>
  cast({
    AreaID: null,
    BuildingID: 1,
    Device: {},
    DeviceID: 1,
    DeviceName: 'ClassicDevice',
    FloorID: null,
    Type: 0,
    ...overrides,
  })
