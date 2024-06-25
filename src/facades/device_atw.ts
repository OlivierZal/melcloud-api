import BaseDeviceFacade, { mapTo } from './device'

export default class extends BaseDeviceFacade<'Atw'> {
  @mapTo('SetCoolFlowTemperatureZone1')
  public accessor coolFlowTemperature: unknown = null

  @mapTo('SetCoolFlowTemperatureZone2')
  public accessor coolFlowTemperatureZone2: unknown = null

  @mapTo('ForcedHotWaterMode')
  public accessor forcedHotWater: unknown = null

  @mapTo('HeatFlowTemperature')
  public accessor heatFlowTemperature: unknown = null

  @mapTo('SetHeatFlowTemperatureZone2')
  public accessor heatFlowTemperatureZone2: unknown = null

  @mapTo('SetTankWaterTemperature')
  public accessor hotWaterTemperature: unknown = null

  @mapTo('OperationModeZone1')
  public accessor mode: unknown = null

  @mapTo('OperationModeZone2')
  public accessor modeZone2: unknown = null

  @mapTo('Power')
  public accessor power: unknown = null

  @mapTo('SetTemperatureZone1')
  public accessor temperature: unknown = null

  @mapTo('SetTemperatureZone2')
  public accessor temperatureZone2: unknown = null
}
