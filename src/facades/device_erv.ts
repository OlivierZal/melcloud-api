import BaseDeviceFacade, { mapTo } from './device'

export default class extends BaseDeviceFacade<'Erv'> {
  @mapTo('RoomCO2Level')
  public accessor co2: unknown = null

  @mapTo('SetFanSpeed')
  public accessor fan: unknown = null

  @mapTo('Power')
  public accessor power: unknown = null

  @mapTo('PM25Level')
  public accessor pm25: unknown = null

  @mapTo('VentilationMode')
  public accessor mode: unknown = null

  @mapTo('OutdoorTemperature')
  public accessor outdoorTemperature: unknown = null

  @mapTo('RoomTemperature')
  public accessor temperature: unknown = null
}
