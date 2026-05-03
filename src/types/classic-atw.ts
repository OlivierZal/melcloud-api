import type {
  ClassicDeviceType,
  ClassicOperationModeState,
  ClassicOperationModeStateHotWater,
  ClassicOperationModeStateZone,
  ClassicOperationModeZone,
} from '../constants.ts'
import type {
  ClassicBaseListDeviceData,
  ClassicBaseSetDeviceData,
  ClassicBaseUpdateDeviceData,
  ClassicTransientDeviceData,
} from './classic-bases.ts'
import type { ClassicGetDeviceData } from './classic-generic.ts'

/** Energy report payload for an ATW (air-to-water) device returned by `EnergyCost/Report`. */
export interface ClassicEnergyDataAtw {
  readonly CoP: readonly number[]
  readonly TotalCoolingConsumed: number
  readonly TotalCoolingProduced: number
  readonly TotalHeatingConsumed: number
  readonly TotalHeatingProduced: number
  readonly TotalHotWaterConsumed: number
  readonly TotalHotWaterProduced: number
}

/** ATW hot water state derived from device data. */
export interface ClassicHotWaterState {
  readonly isEcoHotWater: boolean
  readonly isForcedMode: boolean
  readonly isProhibited: boolean
  readonly maxTankTemperature: number
  readonly operationalState: ClassicOperationModeStateHotWater
  readonly setTankWaterTemperature: number
  readonly tankWaterTemperature: number
}

/** Wire-format `Device` payload for an ATW (air-to-water) unit in `ListDevices`. */
export interface ClassicListDeviceDataAtw
  extends
    ClassicBaseListDeviceData,
    Omit<
      ClassicGetDeviceData<typeof ClassicDeviceType.Atw>,
      keyof ClassicTransientDeviceData
    > {
  readonly BoosterHeater1Status: boolean
  readonly BoosterHeater2PlusStatus: boolean
  readonly BoosterHeater2Status: boolean
  readonly CanCool: boolean
  readonly CondensingTemperature: number
  readonly CurrentEnergyConsumed: number
  readonly CurrentEnergyProduced: number
  readonly DefrostMode: number
  readonly EcoHotWater: boolean
  readonly FlowTemperature: number
  readonly FlowTemperatureZone1: number
  readonly FlowTemperatureZone2: number
  readonly HasZone2: boolean
  readonly HeatPumpFrequency: number
  readonly ImmersionHeaterStatus: boolean
  readonly LastLegionellaActivationTime: string
  readonly MaxTankTemperature: number
  readonly MixingTankWaterTemperature: number
  readonly ReturnTemperature: number
  readonly ReturnTemperatureZone1: number
  readonly ReturnTemperatureZone2: number
  readonly TargetHCTemperatureZone1: number
  readonly TargetHCTemperatureZone2: number
  readonly Zone1InCoolMode: boolean
  readonly Zone1InHeatMode: boolean
  readonly Zone2InCoolMode: boolean
  readonly Zone2InHeatMode: boolean
}

/** Per-zone operation-mode fields on an ATW update payload. */
export interface ClassicOperationModeZoneDataAtw {
  readonly OperationModeZone1?: ClassicOperationModeZone
  readonly OperationModeZone2?: ClassicOperationModeZone
}

/** Wire-format response from `Device/SetAtw`. */
export interface ClassicSetDeviceDataAtw
  extends ClassicBaseSetDeviceData, Required<ClassicUpdateDeviceDataAtw> {
  readonly DeviceType: typeof ClassicDeviceType.Atw
  readonly IdleZone1: boolean
  readonly IdleZone2: boolean
  readonly OperationMode: ClassicOperationModeState
  readonly OutdoorTemperature: number
  readonly ProhibitCoolingZone1: boolean
  readonly ProhibitCoolingZone2: boolean
  readonly ProhibitHeatingZone1: boolean
  readonly ProhibitHeatingZone2: boolean
  readonly ProhibitHotWater: boolean
  readonly RoomTemperatureZone1: number
  readonly RoomTemperatureZone2: number
  readonly TankWaterTemperature: number
}

/** Per-zone target temperatures on an ATW update payload (heating / cooling flow temps, tank water, room set-points). */
export interface ClassicTemperatureDataAtw {
  readonly SetCoolFlowTemperatureZone1?: number
  readonly SetCoolFlowTemperatureZone2?: number
  readonly SetHeatFlowTemperatureZone1?: number
  readonly SetHeatFlowTemperatureZone2?: number
  readonly SetTankWaterTemperature?: number
  readonly SetTemperatureZone1?: number
  readonly SetTemperatureZone2?: number
}

/** Mutable subset of an ATW device's data; combines per-zone operation modes, target temperatures, and the hot-water override. */
export interface ClassicUpdateDeviceDataAtw
  extends
    ClassicBaseUpdateDeviceData,
    ClassicOperationModeZoneDataAtw,
    ClassicTemperatureDataAtw {
  readonly ForcedHotWaterMode?: boolean
}

/** ATW zone state derived from device data. */
export type ClassicZoneAtw = 'Zone1' | 'Zone2'

/** Aggregated heating/cooling state for one zone of an ATW device, derived from `ListDevices` data. */
export interface ClassicZoneState {
  readonly isCoolingProhibited: boolean
  readonly isHeatingProhibited: boolean
  readonly isIdle: boolean
  readonly isInCoolMode: boolean
  readonly isInHeatMode: boolean
  readonly operationalState: ClassicOperationModeStateZone
  readonly operationMode: ClassicOperationModeZone
  readonly roomTemperature: number
  readonly setTemperature: number
}
