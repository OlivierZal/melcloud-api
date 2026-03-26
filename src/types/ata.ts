import type {
  DeviceType,
  FanSpeed,
  Horizontal,
  OperationMode,
  Vertical,
} from '../constants.ts'
import type {
  BaseListDeviceData,
  BaseSetDeviceData,
  BaseUpdateDeviceData,
  TransientDeviceData,
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
  readonly FanSpeed?: Exclude<FanSpeed, typeof FanSpeed.silent> | null
  readonly OperationMode?: OperationMode | null
  readonly Power?: boolean | null
  readonly SetTemperature?: number | null
  readonly VaneHorizontalDirection?: Horizontal | null
  readonly VaneHorizontalSwing?: boolean | null
  readonly VaneVerticalDirection?: Vertical | null
  readonly VaneVerticalSwing?: boolean | null
}

export interface ListDeviceDataAta
  extends
    BaseListDeviceData,
    Omit<
      GetDeviceData<typeof DeviceType.Ata>,
      KeyOfSetDeviceDataAtaNotInList | keyof TransientDeviceData
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
  extends BaseSetDeviceData, Required<UpdateDeviceDataAta> {
  readonly DeviceType: typeof DeviceType.Ata
  readonly NumberOfFanSpeeds: number
  readonly RoomTemperature: number
}

/** ATA properties that use different names in list responses vs set requests (e.g., `FanSpeed` in list, `SetFanSpeed` in set). */
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
  readonly SetFanSpeed?: Exclude<FanSpeed, typeof FanSpeed.silent>
  readonly SetTemperature?: number
  readonly VaneHorizontal?: Horizontal
  readonly VaneVertical?: Vertical
}

/** Set-request property names that have no direct counterpart in list responses (they map to `SetDeviceDataAtaInList` names instead). */
export type KeyOfSetDeviceDataAtaNotInList =
  | 'SetFanSpeed'
  | 'VaneHorizontal'
  | 'VaneVertical'
