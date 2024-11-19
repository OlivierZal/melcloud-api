import type {
  DeviceType,
  OperationModeState,
  OperationModeZone,
} from '../enums.js'

import type {
  BaseDevicePostData,
  BaseGetDeviceData,
  BaseListDevice,
  BaseListDeviceData,
  BaseSetDeviceData,
  BaseUpdateDeviceData,
  DeviceDataNotInList,
} from './bases.js'

export interface EnergyDataAtw {
  readonly CoP: readonly number[]
  readonly TotalCoolingConsumed: number
  readonly TotalCoolingProduced: number
  readonly TotalHeatingConsumed: number
  readonly TotalHeatingProduced: number
  readonly TotalHotWaterConsumed: number
  readonly TotalHotWaterProduced: number
}

export interface ListDeviceAtw extends BaseListDevice {
  readonly Device: ListDeviceDataAtw
}

export interface ListDeviceDataAtw
  extends BaseListDeviceData,
    Omit<GetDeviceDataAtw, keyof DeviceDataNotInList> {
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

export interface OperationModeZoneDataAtw {
  readonly OperationModeZone1?: OperationModeZone
  readonly OperationModeZone2?: OperationModeZone
}

export interface SetDeviceDataAtw
  extends BaseSetDeviceData,
    Required<UpdateDeviceDataAtw> {
  readonly DeviceType: DeviceType.Atw
  readonly IdleZone1: boolean
  readonly IdleZone2: boolean
  readonly OperationMode: OperationModeState
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

export interface SetDevicePostDataAtw
  extends BaseDevicePostData,
    UpdateDeviceDataAtw {}

export interface TemperatureDataAtw {
  readonly SetCoolFlowTemperatureZone1?: number
  readonly SetCoolFlowTemperatureZone2?: number
  readonly SetHeatFlowTemperatureZone1?: number
  readonly SetHeatFlowTemperatureZone2?: number
  readonly SetTankWaterTemperature?: number
  readonly SetTemperatureZone1?: number
  readonly SetTemperatureZone2?: number
}

export interface UpdateDeviceDataAtw
  extends BaseUpdateDeviceData,
    OperationModeZoneDataAtw,
    TemperatureDataAtw {
  readonly ForcedHotWaterMode?: boolean
}

export type GetDeviceDataAtw = BaseGetDeviceData & SetDeviceDataAtw

export type ZoneAtw = 'Zone1' | 'Zone2'
