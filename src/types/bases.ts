import type { DeviceType, FLAG_UNCHANGED } from '../constants.ts'

export interface BaseDevicePostData {
  readonly DeviceID: number
  readonly EffectiveFlags: number
}

export interface BaseGetDeviceData extends BaseSetDeviceData {
  readonly EffectiveFlags: typeof FLAG_UNCHANGED
}

export interface BaseListDevice<T extends DeviceType = DeviceType> {
  readonly AreaID: number | null
  readonly BuildingID: number
  readonly DeviceID: number
  readonly DeviceName: string
  readonly FloorID: number | null
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
