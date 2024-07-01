import BaseDeviceFacade, { mapTo } from './device'
import { NUMBER_0, OperationModeZone } from '../types'

export default class extends BaseDeviceFacade<'Atw'> {
  @mapTo('SetCoolFlowTemperatureZone1')
  public accessor coolFlowTemperature: unknown = NUMBER_0

  @mapTo('SetCoolFlowTemperatureZone2')
  public accessor coolFlowTemperatureZone2: unknown = NUMBER_0

  @mapTo('ForcedHotWaterMode')
  public accessor forcedHotWater: unknown = false

  @mapTo('HeatFlowTemperature')
  public accessor heatFlowTemperature: unknown = NUMBER_0

  @mapTo('SetHeatFlowTemperatureZone2')
  public accessor heatFlowTemperatureZone2: unknown = NUMBER_0

  @mapTo('SetTankWaterTemperature')
  public accessor hotWaterTemperature: unknown = NUMBER_0

  @mapTo('OperationModeZone1')
  public accessor mode: unknown = OperationModeZone.room

  @mapTo('OperationModeZone2')
  public accessor modeZone2: unknown = OperationModeZone.flow

  @mapTo('SetTemperatureZone1')
  public accessor temperature: unknown = NUMBER_0

  @mapTo('SetTemperatureZone2')
  public accessor temperatureZone2: unknown = NUMBER_0
}
