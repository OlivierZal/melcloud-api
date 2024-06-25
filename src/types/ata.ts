import type {
  BaseDevicePostData,
  BaseGetDeviceData,
  BaseListDevice,
  BaseListDeviceData,
  BaseSetDeviceData,
  BaseUpdateDeviceData,
  BaseValues,
  DeviceDataNotInList,
  DeviceType,
  FanSpeed,
} from './bases'

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

export interface UpdateDeviceDataAta extends BaseUpdateDeviceData {
  readonly OperationMode?: OperationMode
  readonly SetFanSpeed?: Exclude<FanSpeed, FanSpeed.silent>
  readonly SetTemperature?: number
  readonly VaneHorizontal?: Horizontal
  readonly VaneVertical?: Vertical
}
export interface SetDevicePostDataAta
  extends UpdateDeviceDataAta,
    BaseDevicePostData {}
export interface SetDeviceDataAta
  extends BaseSetDeviceData,
    Required<UpdateDeviceDataAta> {
  readonly DeviceType: DeviceType.Ata
  readonly NumberOfFanSpeeds: number
  readonly RoomTemperature: number
}

export type GetDeviceDataAta = BaseGetDeviceData & SetDeviceDataAta

export type KeysOfSetDeviceDataAtaNotInList =
  | 'SetFanSpeed'
  | 'VaneHorizontal'
  | 'VaneVertical'
export interface SetDeviceDataAtaInList {
  readonly FanSpeed: FanSpeed
  readonly VaneHorizontalDirection: Horizontal
  readonly VaneVerticalDirection: Vertical
}
export interface ListDeviceDataAta
  extends BaseListDeviceData,
    SetDeviceDataAtaInList,
    Omit<
      GetDeviceDataAta,
      keyof DeviceDataNotInList | KeysOfSetDeviceDataAtaNotInList
    > {
  readonly ActualFanSpeed: number
  readonly HasAutomaticFanSpeed: boolean
  readonly MaxTempAutomatic: number
  readonly MaxTempCoolDry: number
  readonly MaxTempHeat: number
  readonly MinTempAutomatic: number
  readonly MinTempCoolDry: number
  readonly MinTempHeat: number
  readonly OutdoorTemperature: number
}
export interface ListDeviceAta extends BaseListDevice {
  readonly Device: ListDeviceDataAta
}

export interface EnergyDataAta {
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

export interface ValuesAta extends BaseValues {
  readonly fan?: Exclude<FanSpeed, FanSpeed.silent>
  readonly horizontal?: Horizontal
  readonly mode?: OperationMode
  readonly temperature?: number
  readonly vertical?: Vertical
}

export const FLAGS_ATA: Record<keyof UpdateDeviceDataAta, number> = {
  OperationMode: 0x2,
  Power: 0x1,
  SetFanSpeed: 0x8,
  SetTemperature: 0x4,
  VaneHorizontal: 0x100,
  VaneVertical: 0x10,
} as const

export const FROM_SET_TO_LIST_ATA: Record<
  KeysOfSetDeviceDataAtaNotInList,
  keyof SetDeviceDataAtaInList
> = {
  SetFanSpeed: 'FanSpeed',
  VaneHorizontal: 'VaneHorizontalDirection',
  VaneVertical: 'VaneVerticalDirection',
} as const

export const FROM_LIST_TO_SET_ATA: Record<
  keyof SetDeviceDataAtaInList,
  KeysOfSetDeviceDataAtaNotInList
> = Object.fromEntries(
  Object.entries(FROM_SET_TO_LIST_ATA).map(([key, value]) => [value, key]),
) as Record<keyof SetDeviceDataAtaInList, KeysOfSetDeviceDataAtaNotInList>
