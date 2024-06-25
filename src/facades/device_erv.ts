import BaseDeviceFacade, { alias } from './device'

export default class extends BaseDeviceFacade<'Erv'> {
  @alias('RoomCO2Level')
  public accessor co2: unknown = null

  @alias('SetFanSpeed')
  public accessor fan: unknown = null

  @alias('Power')
  public accessor power: unknown = null

  @alias('PM25Level')
  public accessor pm25: unknown = null

  @alias('VentilationMode')
  public accessor mode: unknown = null

  @alias('OutdoorTemperature')
  public accessor outdoorTemperature: unknown = null

  @alias('RoomTemperature')
  public accessor temperature: unknown = null
}
