import type {
  ClassicDeviceType,
  ClassicNonSilentFanSpeed,
  ClassicVentilationMode,
} from '../constants.ts'
import type {
  ClassicBaseListDeviceData,
  ClassicBaseSetDeviceData,
  ClassicBaseUpdateDeviceData,
  ClassicTransientDeviceData,
} from './classic-bases.ts'
import type { ClassicGetDeviceData } from './classic-generic.ts'

export interface ClassicListDeviceDataErv
  extends
    ClassicBaseListDeviceData,
    Omit<
      ClassicGetDeviceData<typeof ClassicDeviceType.Erv>,
      keyof ClassicTransientDeviceData
    > {
  readonly HasAutomaticFanSpeed: boolean
  readonly HasCO2Sensor: boolean
  readonly HasPM25Sensor: boolean
  readonly PM25Level: number
}

export interface ClassicSetDeviceDataErv
  extends ClassicBaseSetDeviceData, Required<ClassicUpdateDeviceDataErv> {
  readonly DeviceType: typeof ClassicDeviceType.Erv
  readonly NumberOfFanSpeeds: number
  readonly OutdoorTemperature: number
  readonly RoomCO2Level: number
  readonly RoomTemperature: number
}

export interface ClassicUpdateDeviceDataErv extends ClassicBaseUpdateDeviceData {
  readonly ClassicVentilationMode?: ClassicVentilationMode
  readonly SetFanSpeed?: ClassicNonSilentFanSpeed
}
