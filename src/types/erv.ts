import type { DeviceType, FanSpeed, VentilationMode } from '../enums.js'

import type {
  BaseDevicePostData,
  BaseGetDeviceData,
  BaseListDevice,
  BaseListDeviceData,
  BaseSetDeviceData,
  BaseUpdateDeviceData,
  DeviceDataNotInList,
} from './bases.js'

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

export interface SetDeviceDataErv
  extends BaseSetDeviceData,
    Required<UpdateDeviceDataErv> {
  readonly DeviceType: DeviceType.Erv
  readonly NumberOfFanSpeeds: number
  readonly OutdoorTemperature: number
  readonly RoomCO2Level: number
  readonly RoomTemperature: number
}

export interface SetDevicePostDataErv
  extends BaseDevicePostData,
    UpdateDeviceDataErv {}

export interface UpdateDeviceDataErv extends BaseUpdateDeviceData {
  readonly SetFanSpeed?: Exclude<FanSpeed, FanSpeed.silent>
  readonly VentilationMode?: VentilationMode
}

export type GetDeviceDataErv = BaseGetDeviceData & SetDeviceDataErv
