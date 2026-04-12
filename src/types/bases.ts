import type { DeviceType, FLAG_UNCHANGED } from '../constants.ts'
import type { AreaID, BuildingID, DeviceID, FloorID } from './ids.ts'

export interface BaseDevicePostData {
  readonly DeviceID: DeviceID
  readonly EffectiveFlags: number
}

export interface BaseGetDeviceData extends BaseSetDeviceData {
  readonly EffectiveFlags: typeof FLAG_UNCHANGED
}

export interface BaseListDevice<T extends DeviceType = DeviceType> {
  readonly AreaID: AreaID | null
  readonly BuildingID: BuildingID
  readonly DeviceID: DeviceID
  readonly DeviceName: string
  readonly FloorID: FloorID | null
  readonly Type: T
}

export interface BaseListDeviceData extends Omit<
  BaseGetDeviceData,
  keyof TransientDeviceData
> {
  readonly WifiSignalStrength: number
}

export interface BaseSetDeviceData
  extends Required<BaseUpdateDeviceData>, TransientDeviceData {
  readonly EffectiveFlags: number
  readonly Offline: boolean
}

export interface BaseUpdateDeviceData {
  readonly Power?: boolean
}

export interface TransientDeviceData {
  readonly LastCommunication: string
  readonly NextCommunication: string
}
