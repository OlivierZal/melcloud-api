export const FLAG_UNCHANGED = 0x0

export type NonEffectiveFlagsKeyOf<T> = Exclude<keyof T, 'EffectiveFlags'>
export type NonEffectiveFlagsValueOf<T> = T[NonEffectiveFlagsKeyOf<T>]

export enum DeviceType {
  Ata = 0,
  Atw = 1,
  Erv = 3,
}

export enum Language {
  en = 0,
  bg = 1,
  cs = 2,
  da = 3,
  de = 4,
  et = 5,
  es = 6,
  fr = 7,
  hy = 8,
  lv = 9,
  lt = 10,
  hu = 11,
  nl = 12,
  no = 13,
  pl = 14,
  pt = 15,
  ru = 16,
  fi = 17,
  sv = 18,
  it = 19,
  uk = 20,
  tr = 21,
  el = 22,
  hr = 23,
  ro = 24,
  sl = 25,
  sq = 26,
}

export enum FanSpeed {
  auto = 0,
  very_slow = 1,
  slow = 2,
  moderate = 3,
  fast = 4,
  very_fast = 5,
  silent = 255,
}

export enum OperationMode {
  heat = 1,
  dry = 2,
  cool = 3,
  fan = 7,
  auto = 8,
}
export enum Vertical {
  auto = 0,
  upwards = 1,
  mid_high = 2,
  middle = 3,
  mid_low = 4,
  downwards = 5,
  swing = 7,
}
export enum Horizontal {
  auto = 0,
  leftwards = 1,
  center_left = 2,
  center = 3,
  center_right = 4,
  rightwards = 5,
  wide = 8,
  swing = 12,
}

export enum OperationModeState {
  idle = 0,
  dhw = 1,
  heating = 2,
  cooling = 3,
  defrost = 5,
  legionella = 6,
}
export enum OperationModeZone {
  room = 0,
  flow = 1,
  curve = 2,
  room_cool = 3,
  flow_cool = 4,
}

export enum VentilationMode {
  recovery = 0,
  bypass = 1,
  auto = 2,
}

export interface BasePostData {
  readonly DeviceID: number
}
export interface BaseSetDeviceData {
  readonly Power?: boolean
  EffectiveFlags: number
}
export interface DeviceDataNotInList {
  readonly LastCommunication: string
  readonly NextCommunication: string
}
export interface BaseDeviceData
  extends Readonly<BaseSetDeviceData>,
    DeviceDataNotInList {
  readonly Offline: boolean
}
export interface BaseDeviceDataFromGet extends BaseDeviceData {
  readonly EffectiveFlags: typeof FLAG_UNCHANGED
}
export interface BaseDeviceDataFromList
  extends Omit<BaseDeviceDataFromGet, keyof DeviceDataNotInList> {
  readonly WifiSignalStrength: number
}

export interface SetDeviceDataAta extends BaseSetDeviceData {
  readonly OperationMode?: OperationMode
  readonly SetFanSpeed?: FanSpeed
  readonly SetTemperature?: number
  readonly VaneHorizontal?: Horizontal
  readonly VaneVertical?: Vertical
}
export const effectiveFlagsAta: Record<
  NonEffectiveFlagsKeyOf<SetDeviceDataAta>,
  number
> = {
  OperationMode: 0x2,
  Power: 0x1,
  SetFanSpeed: 0x8,
  SetTemperature: 0x4,
  VaneHorizontal: 0x100,
  VaneVertical: 0x10,
} as const
export type PostDataAta = BasePostData & Readonly<SetDeviceDataAta>
export interface DeviceDataAta
  extends BaseDeviceData,
    Readonly<SetDeviceDataAta> {
  readonly DeviceType: DeviceType.Ata
  readonly NumberOfFanSpeeds: number
  readonly RoomTemperature: number
}
export type DeviceDataFromGetAta = BaseDeviceDataFromGet & DeviceDataAta
export interface DeviceDataFromListAta
  extends BaseDeviceDataFromList,
    Omit<
      DeviceDataFromGetAta,
      | keyof DeviceDataNotInList
      | 'SetFanSpeed'
      | 'VaneHorizontal'
      | 'VaneVertical'
    > {
  readonly ActualFanSpeed: number
  readonly FanSpeed: FanSpeed
  readonly HasAutomaticFanSpeed: boolean
  readonly MaxTempAutomatic: number
  readonly MaxTempCoolDry: number
  readonly MaxTempHeat: number
  readonly MinTempAutomatic: number
  readonly MinTempCoolDry: number
  readonly MinTempHeat: number
  readonly OutdoorTemperature: number
  readonly VaneHorizontalDirection: Horizontal
  readonly VaneVerticalDirection: Vertical
}

export interface SetDeviceDataAtw extends BaseSetDeviceData {
  readonly ForcedHotWaterMode?: boolean
  readonly OperationModeZone1?: OperationModeZone
  readonly OperationModeZone2?: OperationModeZone
  readonly SetCoolFlowTemperatureZone1?: number
  readonly SetCoolFlowTemperatureZone2?: number
  readonly SetHeatFlowTemperatureZone1?: number
  readonly SetHeatFlowTemperatureZone2?: number
  readonly SetTankWaterTemperature?: number
  readonly SetTemperatureZone1?: number
  readonly SetTemperatureZone2?: number
}
export const effectiveFlagsAtw: Record<
  NonEffectiveFlagsKeyOf<SetDeviceDataAtw>,
  number
> = {
  ForcedHotWaterMode: 0x10000,
  OperationModeZone1: 0x8,
  OperationModeZone2: 0x10,
  Power: 0x1,
  SetCoolFlowTemperatureZone1: 0x1000000000000,
  SetCoolFlowTemperatureZone2: 0x1000000000000,
  SetHeatFlowTemperatureZone1: 0x1000000000000,
  SetHeatFlowTemperatureZone2: 0x1000000000000,
  SetTankWaterTemperature: 0x1000000000020,
  SetTemperatureZone1: 0x200000080,
  SetTemperatureZone2: 0x800000200,
} as const
export type PostDataAtw = BasePostData & Readonly<SetDeviceDataAtw>
export interface DeviceDataAtw
  extends BaseDeviceData,
    Readonly<SetDeviceDataAtw> {
  readonly DeviceType: DeviceType.Atw
  readonly IdleZone1: boolean
  readonly IdleZone2: boolean
  readonly OperationMode: OperationModeState
  readonly OutdoorTemperature: number
  readonly ProhibitCoolingZone1: boolean
  readonly ProhibitCoolingZone2: boolean
  readonly ProhibitHeatingZone1: boolean
  readonly ProhibitHeatingZone2: boolean
  readonly ProhibitHotWater: boolean
  readonly RoomTemperatureZone1: number
  readonly RoomTemperatureZone2: number
  readonly TankWaterTemperature: number
}
export type DeviceDataFromGetAtw = BaseDeviceDataFromGet & DeviceDataAtw
export interface DeviceDataFromListAtw
  extends BaseDeviceDataFromList,
    Omit<DeviceDataFromGetAtw, keyof DeviceDataNotInList> {
  readonly BoosterHeater1Status: boolean
  readonly BoosterHeater2PlusStatus: boolean
  readonly BoosterHeater2Status: boolean
  readonly CanCool: boolean
  readonly CondensingTemperature: number
  readonly CurrentEnergyConsumed: number
  readonly CurrentEnergyProduced: number
  readonly DefrostMode: number
  readonly EcoHotWater: boolean
  readonly FlowTemperature: number
  readonly FlowTemperatureZone1: number
  readonly FlowTemperatureZone2: number
  readonly HasZone2: boolean
  readonly HeatPumpFrequency: number
  readonly ImmersionHeaterStatus: boolean
  readonly LastLegionellaActivationTime: string
  readonly MaxTankTemperature: number
  readonly MixingTankWaterTemperature: number
  readonly ReturnTemperature: number
  readonly ReturnTemperatureZone1: number
  readonly ReturnTemperatureZone2: number
  readonly TargetHCTemperatureZone1: number
  readonly TargetHCTemperatureZone2: number
  readonly Zone1InCoolMode: boolean
  readonly Zone1InHeatMode: boolean
  readonly Zone2InCoolMode: boolean
  readonly Zone2InHeatMode: boolean
}

export interface SetDeviceDataErv extends BaseSetDeviceData {
  readonly SetFanSpeed?: number
  readonly VentilationMode?: VentilationMode
}
export const effectiveFlagsErv: Record<
  NonEffectiveFlagsKeyOf<SetDeviceDataErv>,
  number
> = { Power: 0x1, SetFanSpeed: 0x8, VentilationMode: 0x4 } as const
export type PostDataErv = BasePostData & Readonly<SetDeviceDataErv>
export interface DeviceDataErv
  extends BaseDeviceData,
    Readonly<SetDeviceDataErv> {
  readonly DeviceType: DeviceType.Erv
  readonly NumberOfFanSpeeds: number
  readonly OutdoorTemperature: number
  readonly RoomCO2Level: number
  readonly RoomTemperature: number
}
export type DeviceDataFromGetErv = BaseDeviceDataFromGet & DeviceDataErv
export interface DeviceDataFromListErv
  extends BaseDeviceDataFromList,
    Omit<DeviceDataFromGetErv, keyof DeviceDataNotInList> {
  readonly HasAutomaticFanSpeed: boolean
  readonly HasCO2Sensor: boolean
  readonly HasPM25Sensor: boolean
  readonly PM25Level: number
}

export interface SetDeviceData {
  readonly Ata: SetDeviceDataAta
  readonly Atw: SetDeviceDataAtw
  readonly Erv: SetDeviceDataErv
}
export interface EffectiveFlags {
  readonly Ata: typeof effectiveFlagsAta
  readonly Atw: typeof effectiveFlagsAtw
  readonly Erv: typeof effectiveFlagsErv
}
export interface PostData {
  readonly Ata: PostDataAta
  readonly Atw: PostDataAtw
  readonly Erv: PostDataErv
}
export interface DeviceData {
  readonly Ata: DeviceDataAta
  readonly Atw: DeviceDataAtw
  readonly Erv: DeviceDataErv
}
export interface DeviceDataFromGet {
  readonly Ata: DeviceDataFromGetAta
  readonly Atw: DeviceDataFromGetAtw
  readonly Erv: DeviceDataFromGetErv
}

export interface ReportPostData {
  readonly DeviceID: number
  readonly FromDate: string
  readonly ToDate: string
  readonly UseCurrency: false
}
export interface ReportDataAta {
  readonly Auto: readonly number[]
  readonly Cooling: readonly number[]
  readonly Dry: readonly number[]
  readonly Fan: readonly number[]
  readonly Heating: readonly number[]
  readonly Other: readonly number[]
  readonly TotalAutoConsumed: number
  readonly TotalCoolingConsumed: number
  readonly TotalDryConsumed: number
  readonly TotalFanConsumed: number
  readonly TotalHeatingConsumed: number
  readonly TotalOtherConsumed: number
  readonly UsageDisclaimerPercentages: string
}
export interface ReportDataAtw {
  readonly CoP: readonly number[]
  readonly TotalCoolingConsumed: number
  readonly TotalCoolingProduced: number
  readonly TotalHeatingConsumed: number
  readonly TotalHeatingProduced: number
  readonly TotalHotWaterConsumed: number
  readonly TotalHotWaterProduced: number
}
export interface ReportData {
  readonly Ata: ReportDataAta
  readonly Atw: ReportDataAtw
  readonly Erv: never
}

export interface LoginCredentials {
  readonly password: string
  readonly username: string
}
export interface LoginPostData {
  readonly Language?: number
  readonly Persist?: boolean
  readonly AppVersion: string
  readonly Email: string
  readonly Password: string
}
export interface LoginData {
  readonly LoginData: {
    readonly ContextKey: string
    readonly Expiry: string
  } | null
}

export interface FrostProtectionPostData {
  readonly AreaIds?: readonly number[]
  readonly BuildingIds?: readonly number[]
  readonly DeviceIds?: readonly number[]
  readonly FloorIds?: readonly number[]
  readonly Enabled: boolean
  readonly MaximumTemperature: number
  readonly MinimumTemperature: number
}
export interface FrostProtectionData {
  readonly FPEnabled: boolean
  readonly FPMaxTemperature: number
  readonly FPMinTemperature: number
}

export interface HolidayModePostData {
  readonly Enabled: boolean
  readonly EndDate: {
    readonly Day: number
    readonly Hour: number
    readonly Minute: number
    readonly Month: number
    readonly Second: number
    readonly Year: number
  } | null
  readonly HMTimeZones: readonly {
    readonly Areas?: readonly number[]
    readonly Buildings?: readonly number[]
    readonly Devices?: readonly number[]
    readonly Floors?: readonly number[]
    readonly TimeZone?: number
  }[]
  readonly StartDate: {
    readonly Day: number
    readonly Hour: number
    readonly Minute: number
    readonly Month: number
    readonly Second: number
    readonly Year: number
  } | null
}
export interface HolidayModeData {
  readonly EndDate: {
    readonly Day: number
    readonly Hour: number
    readonly Minute: number
    readonly Month: number
    readonly Second: number
    readonly Year: number
  }
  readonly HMEnabled: boolean
  readonly HMEndDate: string | null
  readonly HMStartDate: string | null
  readonly StartDate: {
    readonly Day: number
    readonly Hour: number
    readonly Minute: number
    readonly Month: number
    readonly Second: number
    readonly Year: number
  }
  readonly TimeZone: number
}

export interface BaseSuccessData {
  readonly AttributeErrors: Record<string, readonly string[]> | null
  readonly Data: null
  readonly GlobalErrors: null
  readonly Success: boolean
}
export interface SuccessData extends BaseSuccessData {
  readonly AttributeErrors: null
  readonly Success: true
}
export interface FailureData extends BaseSuccessData {
  readonly AttributeErrors: Record<string, readonly string[]>
  readonly Success: false
}

export interface BuildingData
  extends FrostProtectionData,
    Omit<HolidayModeData, 'EndDate' | 'StartDate'> {}
export interface BaseListDevice {
  readonly BuildingID: number
  readonly DeviceID: number
  readonly DeviceName: string
}
export interface ListDeviceAta extends BaseListDevice {
  readonly Device: DeviceDataFromListAta
}
export interface ListDeviceAtw extends BaseListDevice {
  readonly Device: DeviceDataFromListAtw
}
export interface ListDeviceErv extends BaseListDevice {
  readonly Device: DeviceDataFromListErv
}
export interface ListDevice {
  readonly Ata: ListDeviceAta
  readonly Atw: ListDeviceAtw
  readonly Erv: ListDeviceErv
}
export type ListDeviceAny = ListDeviceAta | ListDeviceAtw | ListDeviceErv
export interface Building extends BuildingData {
  readonly ID: number
  readonly Name: string
  readonly Structure: {
    readonly Areas: readonly { readonly Devices: readonly ListDeviceAny[] }[]
    readonly Devices: readonly ListDeviceAny[]
    readonly Floors: readonly {
      readonly Areas: readonly { readonly Devices: readonly ListDeviceAny[] }[]
      readonly Devices: readonly ListDeviceAny[]
    }[]
  }
}

export interface DeviceDataParams {
  readonly buildingId: number
  readonly id: number
}
export interface BuildingDataParams {
  readonly id: number
  readonly tableName: 'DeviceLocation'
}

export interface TilesPostData<T extends keyof typeof DeviceType | null> {
  readonly DeviceIDs: readonly number[] &
    (T extends keyof typeof DeviceType ?
      {
        readonly SelectedBuilding: number
        readonly SelectedDevice: number
      }
    : {
        readonly SelectedBuilding?: null
        readonly SelectedDevice?: null
      })
}
export interface TilesData<T extends keyof typeof DeviceType | null> {
  readonly SelectedDevice: T extends keyof typeof DeviceType ?
    DeviceDataFromGet[T]
  : null
  readonly Tiles: readonly {
    Device: number
    Offline: false
    Power: boolean
    RoomTemperature: number
    RoomTemperature2: number
    TankWaterTemperature: number
  }[]
}

export interface ErrorLogPostData {
  readonly DeviceIDs: readonly string[]
  readonly FromDate: string
  readonly ToDate: string
}
export interface ErrorLogData {
  readonly DeviceId: number
  readonly EndDate: string
  readonly ErrorMessage: string | null
  readonly StartDate: string
}
