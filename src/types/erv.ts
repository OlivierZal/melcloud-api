import type {
  BaseDevicePostData,
  BaseGetDeviceData,
  BaseListDevice,
  BaseListDeviceData,
  BaseSetDeviceData,
  BaseUpdateDeviceData,
  BaseValues,
  DeviceDataNotInList,
  DeviceType,
  FanSpeed,
} from './bases'

export enum VentilationMode {
  auto = 2,
  bypass = 1,
  recovery = 0,
}

export interface UpdateDeviceDataErv extends BaseUpdateDeviceData {
  readonly SetFanSpeed?: Exclude<FanSpeed, FanSpeed.silent>
  readonly VentilationMode?: VentilationMode
}
export interface SetDevicePostDataErv
  extends UpdateDeviceDataErv,
    BaseDevicePostData {}
export interface SetDeviceDataErv
  extends BaseSetDeviceData,
    Required<UpdateDeviceDataErv> {
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

export interface ValuesErv extends BaseValues {
  readonly fan?: Exclude<FanSpeed, FanSpeed.silent>
  readonly mode?: VentilationMode
}

export const flagsErv: Record<keyof UpdateDeviceDataErv, number> = {
  Power: 0x1,
  SetFanSpeed: 0x8,
  VentilationMode: 0x4,
} as const
