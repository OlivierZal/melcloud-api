import type { FLAG_UNCHANGED } from '../constants.js'
import type { DeviceType } from '../enums.js'

export interface BaseDevicePostData {
  readonly DeviceID: number
  readonly EffectiveFlags: number
}

export interface BaseGetDeviceData extends BaseSetDeviceData {
  readonly EffectiveFlags: typeof FLAG_UNCHANGED
}

export interface BaseListDevice {
  readonly AreaID: number | null
  readonly BuildingID: number
  readonly DeviceID: number
  readonly DeviceName: string
  readonly FloorID: number | null
  readonly Type: DeviceType
}

export interface BaseListDeviceData
  extends Omit<BaseGetDeviceData, keyof DeviceDataNotInList> {
  readonly WifiSignalStrength: number
}

export interface BaseSetDeviceData
  extends DeviceDataNotInList,
    Required<BaseUpdateDeviceData> {
  readonly EffectiveFlags: number
  readonly Offline: boolean
}

export interface BaseUpdateDeviceData {
  readonly Power?: boolean
}

export interface DeviceDataNotInList {
  readonly LastCommunication: string
  readonly NextCommunication: string
}
