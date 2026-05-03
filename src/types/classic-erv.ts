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

/**
 * Wire-format `Device` payload for an ERV (energy-recovery ventilation) unit in `ListDevices`.
 * @category Types
 */
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

/**
 * Wire-format response from `Device/SetErv`.
 * @category Types
 */
export interface ClassicSetDeviceDataErv
  extends ClassicBaseSetDeviceData, Required<ClassicUpdateDeviceDataErv> {
  readonly DeviceType: typeof ClassicDeviceType.Erv
  readonly NumberOfFanSpeeds: number
  readonly OutdoorTemperature: number
  readonly RoomCO2Level: number
  readonly RoomTemperature: number
}

/**
 * Mutable subset of an ERV device's data; every field is optional so callers can push partial updates.
 * @category Types
 */
export interface ClassicUpdateDeviceDataErv extends ClassicBaseUpdateDeviceData {
  readonly SetFanSpeed?: ClassicNonSilentFanSpeed
  readonly VentilationMode?: ClassicVentilationMode
}
