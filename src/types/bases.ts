export const FLAG_UNCHANGED = 0x0

export enum DeviceType {
  Ata = 0,
  Atw = 1,
  Erv = 3,
}

export enum FanSpeed {
  auto = 0,
  fast = 4,
  moderate = 3,
  silent = 255,
  slow = 2,
  very_fast = 5,
  very_slow = 1,
}

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

export interface BaseValues {
  readonly power?: boolean
}
