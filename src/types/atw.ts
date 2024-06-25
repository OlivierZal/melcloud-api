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
} from './bases'

export enum OperationModeState {
  idle = 0,
  dhw = 1,
  heating = 2,
  cooling = 3,
  defrost = 5,
  legionella = 6,
}

export enum OperationModeZone {
  room = 0,
  flow = 1,
  curve = 2,
  room_cool = 3,
  flow_cool = 4,
}

export interface UpdateDeviceDataAtw extends BaseUpdateDeviceData {
  readonly ForcedHotWaterMode?: boolean
  readonly OperationModeZone1?: OperationModeZone
  readonly OperationModeZone2?: OperationModeZone
  readonly SetCoolFlowTemperatureZone1?: number
  readonly SetCoolFlowTemperatureZone2?: number
  readonly SetHeatFlowTemperatureZone1?: number
  readonly SetHeatFlowTemperatureZone2?: number
  readonly SetTankWaterTemperature?: number
  readonly SetTemperatureZone1?: number
  readonly SetTemperatureZone2?: number
}
export interface SetDevicePostDataAtw
  extends UpdateDeviceDataAtw,
    BaseDevicePostData {}
export interface SetDeviceDataAtw
  extends BaseSetDeviceData,
    Required<Readonly<UpdateDeviceDataAtw>> {
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

export type GetDeviceDataAtw = BaseGetDeviceData & SetDeviceDataAtw

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
export interface ListDeviceAtw extends BaseListDevice {
  readonly Device: ListDeviceDataAtw
}

export interface EnergyDataAtw {
  readonly CoP: readonly number[]
  readonly TotalCoolingConsumed: number
  readonly TotalCoolingProduced: number
  readonly TotalHeatingConsumed: number
  readonly TotalHeatingProduced: number
  readonly TotalHotWaterConsumed: number
  readonly TotalHotWaterProduced: number
}

export const flagsAtw: Record<keyof UpdateDeviceDataAtw, number> = {
  ForcedHotWaterMode: 0x10000,
  OperationModeZone1: 0x8,
  OperationModeZone2: 0x10,
  Power: 0x1,
  SetCoolFlowTemperatureZone1: 0x1000000000000,
  SetCoolFlowTemperatureZone2: 0x1000000000000,
  SetHeatFlowTemperatureZone1: 0x1000000000000,
  SetHeatFlowTemperatureZone2: 0x1000000000000,
  SetTankWaterTemperature: 0x1000000000020,
  SetTemperatureZone1: 0x200000080,
  SetTemperatureZone2: 0x800000200,
} as const

export interface ValuesAtw extends BaseValues {
  readonly coolFlowTemperature?: number
  readonly coolFlowTemperatureZone2?: number
  readonly forcedHotWater?: boolean
  readonly heatFlowTemperature?: number
  readonly heatFlowTemperatureZone2?: number
  readonly hotWaterTemperature?: number
  readonly mode?: OperationModeZone
  readonly modeZone2?: OperationModeZone
  readonly temperature?: number
  readonly temperatureZone2?: number
}
