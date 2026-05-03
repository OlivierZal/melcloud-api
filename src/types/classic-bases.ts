import type { CLASSIC_FLAG_UNCHANGED, ClassicDeviceType } from '../constants.ts'
import type {
  ClassicAreaID,
  ClassicBuildingID,
  ClassicDeviceID,
  ClassicFloorID,
} from './ids.ts'

/** Common header fields for any `Device/Set*` POST body: target id and the bitfield identifying which mutated fields should be applied. */
export interface ClassicBaseDevicePostData {
  readonly DeviceID: ClassicDeviceID
  readonly EffectiveFlags: number
}

/** Shape returned by `Device/Get` for any device type — same body as a set-device payload but with `EffectiveFlags` pinned to the unchanged sentinel. */
export interface ClassicBaseGetDeviceData extends ClassicBaseSetDeviceData {
  readonly EffectiveFlags: typeof CLASSIC_FLAG_UNCHANGED
}

export interface ClassicBaseListDevice<
  T extends ClassicDeviceType = ClassicDeviceType,
> {
  readonly AreaID: ClassicAreaID | null
  readonly BuildingID: ClassicBuildingID
  readonly DeviceID: ClassicDeviceID
  readonly DeviceName: string
  readonly FloorID: ClassicFloorID | null
  readonly Type: T
}

export interface ClassicBaseListDeviceData extends Omit<
  ClassicBaseGetDeviceData,
  keyof ClassicTransientDeviceData
> {
  readonly WifiSignalStrength: number
}

export interface ClassicBaseSetDeviceData
  extends ClassicTransientDeviceData, Required<ClassicBaseUpdateDeviceData> {
  readonly EffectiveFlags: number
  readonly Offline: boolean
}

export interface ClassicBaseUpdateDeviceData {
  readonly Power?: boolean
}

export interface ClassicTransientDeviceData {
  readonly LastCommunication: string
  readonly NextCommunication: string
}
