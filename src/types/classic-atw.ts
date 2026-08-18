import type { AtwHotWaterState, AtwZoneState } from '../atw-state.ts'
import type {
  ClassicDeviceType,
  ClassicLabelType,
  ClassicOperationModeState,
  ClassicOperationModeZone,
} from '../constants.ts'
import type {
  ClassicBaseListDeviceData,
  ClassicBaseSetDeviceData,
  ClassicBaseUpdateDeviceData,
  ClassicTransientDeviceData,
} from './classic-bases.ts'
import type { ClassicGetDeviceData } from './classic-generic.ts'

/**
 * Energy report payload for an ATW (air-to-water) device returned by `EnergyCost/Report`.
 * The consumed/produced arrays are energy buckets aligned with `Labels`;
 * `Labels` is numeric on this endpoint (live payload, 2026-07-18).
 * @category Types
 */
export interface ClassicEnergyDataAtw {
  readonly Cooling: readonly number[]
  readonly CoP: readonly (number | null)[]
  readonly Heating: readonly number[]
  readonly HotWater: readonly number[]
  readonly Labels: readonly number[]
  readonly LabelType: ClassicLabelType
  readonly ProducedCooling: readonly number[]
  readonly ProducedHeating: readonly number[]
  readonly ProducedHotWater: readonly number[]
  readonly TotalCoolingConsumed: number
  readonly TotalCoolingProduced: number
  readonly TotalHeatingConsumed: number
  readonly TotalHeatingProduced: number
  readonly TotalHotWaterConsumed: number
  readonly TotalHotWaterProduced: number
}

/**
 * ATW hot water state derived from device data — the cross-dialect
 * {@link AtwHotWaterState} kept precise: the Classic wire always
 * carries the eco flag and the reported tank maximum.
 * @category Types
 */
export interface ClassicHotWaterState extends AtwHotWaterState {
  /**
   * Whether eco hot-water mode is on.
   */
  readonly isEcoHotWater: boolean
  /**
   * Reported tank maximum, in °C.
   */
  readonly maxTankTemperature: number
}

/**
 * Wire-format `Device` payload for an ATW (air-to-water) unit in `ListDevices`.
 * @category Types
 */
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

/**
 * Per-zone operation-mode fields on an ATW update payload.
 * @category Types
 */
export interface ClassicOperationModeZoneDataAtw {
  readonly OperationModeZone1?: ClassicOperationModeZone
  readonly OperationModeZone2?: ClassicOperationModeZone
}

/**
 * Wire-format response from `Device/SetAtw`.
 * @category Types
 */
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

/**
 * Per-zone target temperatures on an ATW update payload (heating / cooling flow temps, tank water, room set-points).
 * @category Types
 */
export interface ClassicTemperatureDataAtw {
  readonly SetCoolFlowTemperatureZone1?: number
  readonly SetCoolFlowTemperatureZone2?: number
  readonly SetHeatFlowTemperatureZone1?: number
  readonly SetHeatFlowTemperatureZone2?: number
  readonly SetTankWaterTemperature?: number
  readonly SetTemperatureZone1?: number
  readonly SetTemperatureZone2?: number
}

/**
 * Mutable subset of an ATW device's data; combines per-zone operation modes, target temperatures, and the hot-water override.
 * @category Types
 */
export interface ClassicUpdateDeviceDataAtw
  extends
    ClassicBaseUpdateDeviceData,
    ClassicOperationModeZoneDataAtw,
    ClassicTemperatureDataAtw {
  readonly ForcedHotWaterMode?: boolean
}

/**
 * ATW zone state derived from device data.
 * @category Types
 */
export type ClassicZoneAtw = 'Zone1' | 'Zone2'

/**
 * Aggregated heating/cooling state for one zone of an ATW device,
 * derived from `ListDevices` data — the cross-dialect
 * {@link AtwZoneState} kept precise: the Classic wire always carries
 * the flag refinements the Home wire lacks.
 * @category Types
 */
export interface ClassicZoneState extends AtwZoneState {
  /**
   * Whether cooling is prohibited on the zone.
   */
  readonly isCoolingProhibited: boolean
  /**
   * Whether heating is prohibited on the zone.
   */
  readonly isHeatingProhibited: boolean
  /**
   * Whether the zone reports idle.
   */
  readonly isIdle: boolean
  /**
   * Whether the zone is in a cooling mode.
   */
  readonly isInCoolMode: boolean
  /**
   * Whether the zone is in a heating mode.
   */
  readonly isInHeatMode: boolean
}
