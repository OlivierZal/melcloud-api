import type { DeviceType, FanSpeed, VentilationMode } from '../enums.ts'

import type {
  BaseListDeviceData,
  BaseSetDeviceData,
  BaseUpdateDeviceData,
  DeviceDataNotInList,
} from './bases.ts'
import type { GetDeviceData } from './common.ts'

export interface ListDeviceDataErv
  extends BaseListDeviceData,
    Omit<GetDeviceData<DeviceType.Erv>, keyof DeviceDataNotInList> {
  readonly HasAutomaticFanSpeed: boolean
  readonly HasCO2Sensor: boolean
  readonly HasPM25Sensor: boolean
  readonly PM25Level: number
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

export interface UpdateDeviceDataErv extends BaseUpdateDeviceData {
  readonly SetFanSpeed?: Exclude<FanSpeed, FanSpeed.silent>
  readonly VentilationMode?: VentilationMode
}
