import type {
  ClassicDeviceType,
  ClassicNonSilentFanSpeed,
  VentilationMode,
} from '../constants.ts'
import type {
  BaseListDeviceData,
  BaseSetDeviceData,
  BaseUpdateDeviceData,
  TransientDeviceData,
} from './classic-bases.ts'
import type { GetDeviceData } from './classic-generic.ts'

export interface ListDeviceDataErv
  extends
    BaseListDeviceData,
    Omit<
      GetDeviceData<typeof ClassicDeviceType.Erv>,
      keyof TransientDeviceData
    > {
  readonly HasAutomaticFanSpeed: boolean
  readonly HasCO2Sensor: boolean
  readonly HasPM25Sensor: boolean
  readonly PM25Level: number
}

export interface SetDeviceDataErv
  extends BaseSetDeviceData, Required<UpdateDeviceDataErv> {
  readonly DeviceType: typeof ClassicDeviceType.Erv
  readonly NumberOfFanSpeeds: number
  readonly OutdoorTemperature: number
  readonly RoomCO2Level: number
  readonly RoomTemperature: number
}

export interface UpdateDeviceDataErv extends BaseUpdateDeviceData {
  readonly SetFanSpeed?: ClassicNonSilentFanSpeed
  readonly VentilationMode?: VentilationMode
}
