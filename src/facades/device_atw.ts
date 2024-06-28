import type { NonFlagsKeyOf, SetKeys, UpdateDeviceData } from '../types'
import BaseDeviceFacade from './device'

export default class extends BaseDeviceFacade<'Atw'> {
  protected readonly setDataMapping: Record<
    NonFlagsKeyOf<UpdateDeviceData['Atw']>,
    keyof SetKeys['Atw']
  > = {
    ForcedHotWaterMode: 'forceHotWater',
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

  protected readonly setKeyMapping: Record<
    keyof SetKeys['Atw'],
    NonFlagsKeyOf<UpdateDeviceData['Atw']>
  > = {
    coolFlowTemperature: 'SetCoolFlowTemperatureZone1',
    coolFlowTemperatureZone2: 'SetCoolFlowTemperatureZone2',
    forceHotWater: 'ForcedHotWaterMode',
    heatFlowTemperature: 'SetHeatFlowTemperatureZone1',
    heatFlowTemperatureZone2: 'SetHeatFlowTemperatureZone2',
    hotWaterTemperature: 'SetTankWaterTemperature',
    mode: 'OperationModeZone1',
    modeZone2: 'OperationModeZone2',
    power: 'Power',
    temperature: 'SetTemperatureZone1',
    temperatureZone2: 'SetTemperatureZone2',
  }
}
