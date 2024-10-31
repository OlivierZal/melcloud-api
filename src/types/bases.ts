import type { FLAG_UNCHANGED } from '../constants.js'
import type { DeviceType } from '../enums.js'

export interface BaseUpdateDeviceData {
  readonly Power?: boolean
}

export interface BaseDevicePostData {
  readonly DeviceID: number
  readonly EffectiveFlags: number
}

export interface DeviceDataNotInList {
  readonly LastCommunication: string
  readonly NextCommunication: string
}

export interface BaseSetDeviceData
  extends Required<BaseUpdateDeviceData>,
    DeviceDataNotInList {
  readonly EffectiveFlags: number
  readonly Offline: boolean
}

export interface BaseGetDeviceData extends BaseSetDeviceData {
  readonly EffectiveFlags: typeof FLAG_UNCHANGED
}

export interface BaseListDeviceData
  extends Omit<BaseGetDeviceData, keyof DeviceDataNotInList> {
  readonly WifiSignalStrength: number
}

export interface BaseListDevice {
  readonly AreaID: number | null
  readonly BuildingID: number
  readonly DeviceID: number
  readonly DeviceName: string
  readonly FloorID: number | null
  readonly Type: DeviceType
}
