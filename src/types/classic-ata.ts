import type {
  ClassicDeviceType,
  ClassicFanSpeed,
  ClassicHorizontal,
  ClassicNonSilentFanSpeed,
  ClassicOperationMode,
  ClassicVertical,
} from '../constants.ts'
import type {
  ClassicBaseListDeviceData,
  ClassicBaseSetDeviceData,
  ClassicBaseUpdateDeviceData,
  ClassicTransientDeviceData,
} from './classic-bases.ts'
import type { ClassicGetDeviceData } from './classic-generic.ts'
import type { ClassicAreaID, ClassicBuildingID, ClassicFloorID } from './ids.ts'

export interface ClassicEnergyDataAta {
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

export interface ClassicGetGroupData {
  readonly Data: {
    readonly Group: {
      readonly Specification: Required<ClassicSetGroupPostData['Specification']>
      readonly State: Required<ClassicSetGroupPostData['State']>
    }
  }
}

export interface ClassicGetGroupPostData {
  readonly AreaID?: ClassicAreaID | null
  readonly BuildingID?: ClassicBuildingID | null
  readonly FloorID?: ClassicFloorID | null
}

export interface ClassicGroupState {
  readonly FanSpeed?: ClassicNonSilentFanSpeed | null
  readonly OperationMode?: ClassicOperationMode | null
  readonly Power?: boolean | null
  readonly SetTemperature?: number | null
  readonly VaneHorizontalDirection?: ClassicHorizontal | null
  readonly VaneHorizontalSwing?: boolean | null
  readonly VaneVerticalDirection?: ClassicVertical | null
  readonly VaneVerticalSwing?: boolean | null
}

export interface ClassicListDeviceDataAta
  extends
    ClassicBaseListDeviceData,
    ClassicSetDeviceDataAtaInList,
    Omit<
      ClassicGetDeviceData<typeof ClassicDeviceType.Ata>,
      KeyOfClassicSetDeviceDataAtaNotInList | keyof ClassicTransientDeviceData
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

export interface ClassicSetDeviceDataAta
  extends ClassicBaseSetDeviceData, Required<ClassicUpdateDeviceDataAta> {
  readonly DeviceType: typeof ClassicDeviceType.Ata
  readonly NumberOfFanSpeeds: number
  readonly RoomTemperature: number
}

/** ATA properties that use different names in list responses vs set requests (e.g., `ClassicFanSpeed` in list, `SetFanSpeed` in set). */
export interface ClassicSetDeviceDataAtaInList {
  readonly VaneHorizontalDirection: ClassicHorizontal
  readonly VaneVerticalDirection: ClassicVertical
  readonly FanSpeed?: ClassicFanSpeed
}

export interface ClassicSetGroupPostData {
  readonly Specification: ClassicGetGroupPostData
  readonly State: ClassicGroupState
}

export interface ClassicUpdateDeviceDataAta extends ClassicBaseUpdateDeviceData {
  readonly OperationMode?: ClassicOperationMode
  readonly SetFanSpeed?: ClassicNonSilentFanSpeed
  readonly SetTemperature?: number
  readonly VaneHorizontal?: ClassicHorizontal
  readonly VaneVertical?: ClassicVertical
}

/** Set-request property names that have no direct counterpart in list responses (they map to `ClassicSetDeviceDataAtaInList` names instead). */
export type KeyOfClassicSetDeviceDataAtaNotInList =
  | 'SetFanSpeed'
  | 'VaneHorizontal'
  | 'VaneVertical'
