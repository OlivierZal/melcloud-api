import type {
  DeviceType,
  FanSpeed,
  Horizontal,
  OperationMode,
  Vertical,
} from '../enums.js'

import type {
  BaseDevicePostData,
  BaseGetDeviceData,
  BaseListDevice,
  BaseListDeviceData,
  BaseSetDeviceData,
  BaseUpdateDeviceData,
  DeviceDataNotInList,
} from './bases.js'

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

export type GetDeviceDataAta = BaseGetDeviceData & SetDeviceDataAta

export type KeysOfSetDeviceDataAtaNotInList =
  | 'SetFanSpeed'
  | 'VaneHorizontal'
  | 'VaneVertical'

export interface ListDeviceAta extends BaseListDevice {
  readonly Device: ListDeviceDataAta
}

export interface ListDeviceDataAta
  extends BaseListDeviceData,
    Omit<
      GetDeviceDataAta,
      KeysOfSetDeviceDataAtaNotInList | keyof DeviceDataNotInList
    >,
    SetDeviceDataAtaInList {
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

export interface SetDeviceDataAta
  extends BaseSetDeviceData,
    Required<UpdateDeviceDataAta> {
  readonly DeviceType: DeviceType.Ata
  readonly NumberOfFanSpeeds: number
  readonly RoomTemperature: number
}

export interface SetDeviceDataAtaInList {
  readonly FanSpeed: FanSpeed
  readonly VaneHorizontalDirection: Horizontal
  readonly VaneVerticalDirection: Vertical
}

export interface SetDevicePostDataAta
  extends BaseDevicePostData,
    UpdateDeviceDataAta {}

export interface UpdateDeviceDataAta extends BaseUpdateDeviceData {
  readonly OperationMode?: OperationMode
  readonly SetFanSpeed?: Exclude<FanSpeed, FanSpeed.silent>
  readonly SetTemperature?: number
  readonly VaneHorizontal?: Horizontal
  readonly VaneVertical?: Vertical
}
