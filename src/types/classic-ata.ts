import type {
  ClassicDeviceType,
  ClassicFanSpeed,
  ClassicHorizontal,
  ClassicNonSilentFanSpeed,
  ClassicOperationMode,
  ClassicVertical,
} from '../constants.ts'
import type {
  BaseListDeviceData,
  BaseSetDeviceData,
  BaseUpdateDeviceData,
  TransientDeviceData,
} from './classic-bases.ts'
import type { GetDeviceData } from './classic-generic.ts'
import type { AreaID, BuildingID, FloorID } from './ids.ts'

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
  readonly AreaID?: AreaID | null
  readonly BuildingID?: BuildingID | null
  readonly FloorID?: FloorID | null
}

export interface GroupState {
  readonly FanSpeed?: ClassicNonSilentFanSpeed | null
  readonly OperationMode?: ClassicOperationMode | null
  readonly Power?: boolean | null
  readonly SetTemperature?: number | null
  readonly VaneHorizontalDirection?: ClassicHorizontal | null
  readonly VaneHorizontalSwing?: boolean | null
  readonly VaneVerticalDirection?: ClassicVertical | null
  readonly VaneVerticalSwing?: boolean | null
}

export interface ListDeviceDataAta
  extends
    BaseListDeviceData,
    Omit<
      GetDeviceData<typeof ClassicDeviceType.Ata>,
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
  readonly DeviceType: typeof ClassicDeviceType.Ata
  readonly NumberOfFanSpeeds: number
  readonly RoomTemperature: number
}

/** ATA properties that use different names in list responses vs set requests (e.g., `ClassicFanSpeed` in list, `SetFanSpeed` in set). */
export interface SetDeviceDataAtaInList {
  readonly VaneHorizontalDirection: ClassicHorizontal
  readonly VaneVerticalDirection: ClassicVertical
  readonly FanSpeed?: ClassicFanSpeed
}

export interface SetGroupPostData {
  readonly Specification: GetGroupPostData
  readonly State: GroupState
}

export interface UpdateDeviceDataAta extends BaseUpdateDeviceData {
  readonly OperationMode?: ClassicOperationMode
  readonly SetFanSpeed?: ClassicNonSilentFanSpeed
  readonly SetTemperature?: number
  readonly VaneHorizontal?: ClassicHorizontal
  readonly VaneVertical?: ClassicVertical
}

/** Set-request property names that have no direct counterpart in list responses (they map to `SetDeviceDataAtaInList` names instead). */
export type KeyOfSetDeviceDataAtaNotInList =
  | 'SetFanSpeed'
  | 'VaneHorizontal'
  | 'VaneVertical'
