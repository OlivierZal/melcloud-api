import type {
  BaseGetDeviceData,
  BaseListDevice,
  BaseListDeviceData,
  BaseSetDeviceData,
  BaseSetKeys,
  BaseUpdateDeviceData,
  DeviceDataNotInList,
  DeviceType,
  FanSpeed,
  NonFlagsKeyOf,
} from './bases'

export enum VentilationMode {
  recovery = 0,
  bypass = 1,
  auto = 2,
}

export interface UpdateDeviceDataErv extends BaseUpdateDeviceData {
  readonly SetFanSpeed?: Exclude<FanSpeed, FanSpeed.silent>
  readonly VentilationMode?: VentilationMode
}

export const flagsErv: Record<NonFlagsKeyOf<UpdateDeviceDataErv>, number> = {
  Power: 0x1,
  SetFanSpeed: 0x8,
  VentilationMode: 0x4,
} as const

export interface SetKeysErv extends BaseSetKeys {
  readonly fan?: Exclude<FanSpeed, FanSpeed.silent>
  readonly mode?: VentilationMode
}

export interface SetDeviceDataErv
  extends BaseSetDeviceData,
    Required<Readonly<UpdateDeviceDataErv>> {
  readonly DeviceType: DeviceType.Erv
  readonly NumberOfFanSpeeds: number
  readonly OutdoorTemperature: number
  readonly RoomCO2Level: number
  readonly RoomTemperature: number
}

export type GetDeviceDataErv = BaseGetDeviceData & SetDeviceDataErv

export interface ListDeviceDataErv
  extends BaseListDeviceData,
    Omit<GetDeviceDataErv, keyof DeviceDataNotInList> {
  readonly HasAutomaticFanSpeed: boolean
  readonly HasCO2Sensor: boolean
  readonly HasPM25Sensor: boolean
  readonly PM25Level: number
}
export interface ListDeviceErv extends BaseListDevice {
  readonly Device: ListDeviceDataErv
}
