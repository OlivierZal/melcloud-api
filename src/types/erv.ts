import type { DeviceType, FanSpeed, VentilationMode } from '../constants.ts'

import type {
  BaseListDeviceData,
  BaseSetDeviceData,
  BaseUpdateDeviceData,
  DeviceDataNotInList,
} from './bases.ts'
import type { GetDeviceData } from './generic.ts'

export interface ListDeviceDataErv
  extends
    BaseListDeviceData,
    Omit<GetDeviceData<typeof DeviceType.Erv>, keyof DeviceDataNotInList> {
  readonly HasAutomaticFanSpeed: boolean
  readonly HasCO2Sensor: boolean
  readonly HasPM25Sensor: boolean
  readonly PM25Level: number
}

export interface SetDeviceDataErv
  extends BaseSetDeviceData, Required<UpdateDeviceDataErv> {
  readonly DeviceType: typeof DeviceType.Erv
  readonly NumberOfFanSpeeds: number
  readonly OutdoorTemperature: number
  readonly RoomCO2Level: number
  readonly RoomTemperature: number
}

export interface UpdateDeviceDataErv extends BaseUpdateDeviceData {
  readonly SetFanSpeed?: Exclude<FanSpeed, typeof FanSpeed.silent>
  readonly VentilationMode?: VentilationMode
}
