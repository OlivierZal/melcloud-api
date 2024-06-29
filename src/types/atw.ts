import type {
  BaseGetDeviceData,
  BaseListDevice,
  BaseListDeviceData,
  BaseSetDeviceData,
  BaseSetKeys,
  BaseUpdateDeviceData,
  DeviceDataNotInList,
  DeviceType,
  NonFlagsKeyOf,
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

export interface SetKeysAtw extends BaseSetKeys {
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

export const flagsAtw: Record<keyof SetKeysAtw, number> = {
  coolFlowTemperature: 0x1000000000000,
  coolFlowTemperatureZone2: 0x1000000000000,
  forcedHotWater: 0x10000,
  heatFlowTemperature: 0x1000000000000,
  heatFlowTemperatureZone2: 0x1000000000000,
  hotWaterTemperature: 0x1000000000020,
  mode: 0x8,
  modeZone2: 0x10,
  power: 0x1,
  temperature: 0x200000080,
  temperatureZone2: 0x800000200,
} as const

export const setDataMappingAtw: Record<
  NonFlagsKeyOf<UpdateDeviceDataAtw>,
  keyof SetKeysAtw
> = {
  ForcedHotWaterMode: 'forcedHotWater',
  OperationModeZone1: 'mode',
  OperationModeZone2: 'modeZone2',
  Power: 'power',
  SetCoolFlowTemperatureZone1: 'coolFlowTemperature',
  SetCoolFlowTemperatureZone2: 'coolFlowTemperatureZone2',
  SetHeatFlowTemperatureZone1: 'heatFlowTemperature',
  SetHeatFlowTemperatureZone2: 'heatFlowTemperatureZone2',
  SetTankWaterTemperature: 'hotWaterTemperature',
  SetTemperatureZone1: 'temperature',
  SetTemperatureZone2: 'temperatureZone2',
}

export const setKeyMappingAtw: Record<
  keyof SetKeysAtw,
  NonFlagsKeyOf<UpdateDeviceDataAtw>
> = {
  coolFlowTemperature: 'SetCoolFlowTemperatureZone1',
  coolFlowTemperatureZone2: 'SetCoolFlowTemperatureZone2',
  forcedHotWater: 'ForcedHotWaterMode',
  heatFlowTemperature: 'SetHeatFlowTemperatureZone1',
  heatFlowTemperatureZone2: 'SetHeatFlowTemperatureZone2',
  hotWaterTemperature: 'SetTankWaterTemperature',
  mode: 'OperationModeZone1',
  modeZone2: 'OperationModeZone2',
  power: 'Power',
  temperature: 'SetTemperatureZone1',
  temperatureZone2: 'SetTemperatureZone2',
}
