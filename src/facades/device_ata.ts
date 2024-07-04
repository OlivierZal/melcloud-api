import BaseDeviceFacade, { mapTo } from './device'

export default class extends BaseDeviceFacade<'Ata'> {
  @mapTo('ActualFanSpeed')
  public accessor actualFan: unknown = null

  @mapTo('FanSpeed')
  public accessor fan: unknown = null

  @mapTo('VaneHorizontalDirection')
  public accessor horizontal: unknown = null

  @mapTo('OperationMode')
  public accessor mode: unknown = null

  @mapTo('Power')
  public accessor power: unknown = null

  @mapTo('OutdoorTemperature')
  public accessor outdoorTemperature: unknown = null

  @mapTo('SetTemperature')
  public accessor targetTemperature: unknown = null

  @mapTo('RoomTemperature')
  public accessor temperature: unknown = null

  @mapTo('VaneVerticalDirection')
  public accessor vertical: unknown = null
}
