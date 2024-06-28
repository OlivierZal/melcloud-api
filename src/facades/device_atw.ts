import type { NonFlagsKeyOf, SetKeys, UpdateDeviceData } from '../types'
import BaseDeviceFacade from './device'

export default class extends BaseDeviceFacade<'Atw'> {
  protected setKeys: Record<
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
