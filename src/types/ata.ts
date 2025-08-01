import type {
  DeviceType,
  FanSpeed,
  Horizontal,
  OperationMode,
  Vertical,
} from '../enums.ts'

import type {
  BaseListDeviceData,
  BaseSetDeviceData,
  BaseUpdateDeviceData,
  DeviceDataNotInList,
} from './bases.ts'
import type { GetDeviceData } from './generic.ts'

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

export interface GetGroupData {
  readonly Data: {
    readonly Group: {
      readonly Specification: Required<SetGroupPostData['Specification']>
      readonly State: Required<SetGroupPostData['State']>
    }
  }
}

export interface GetGroupPostData {
  readonly AreaID?: number | null
  readonly BuildingID?: number | null
  readonly FloorID?: number | null
}

export interface GroupState {
  readonly FanSpeed?: Exclude<FanSpeed, FanSpeed.silent> | null
  readonly OperationMode?: OperationMode | null
  readonly Power?: boolean | null
  readonly SetTemperature?: number | null
  readonly VaneHorizontalDirection?: Horizontal | null
  readonly VaneHorizontalSwing?: boolean | null
  readonly VaneVerticalDirection?: Vertical | null
  readonly VaneVerticalSwing?: boolean | null
}

export interface ListDeviceDataAta
  extends BaseListDeviceData,
    Omit<
      GetDeviceData<DeviceType.Ata>,
      KeyofSetDeviceDataAtaNotInList | keyof DeviceDataNotInList
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

export interface SetGroupPostData {
  readonly Specification: GetGroupPostData
  readonly State: GroupState
}

export interface UpdateDeviceDataAta extends BaseUpdateDeviceData {
  readonly OperationMode?: OperationMode
  readonly SetFanSpeed?: Exclude<FanSpeed, FanSpeed.silent>
  readonly SetTemperature?: number
  readonly VaneHorizontal?: Horizontal
  readonly VaneVertical?: Vertical
}

export type KeyofSetDeviceDataAtaNotInList =
  | 'SetFanSpeed'
  | 'VaneHorizontal'
  | 'VaneVertical'
