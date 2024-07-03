import BaseDeviceFacade, { mapTo } from './device'

export default class extends BaseDeviceFacade<'Ata'> {
  @mapTo('FanSpeed')
  public accessor fan: unknown = null

  @mapTo('VaneHorizontalDirection')
  public accessor horizontal: unknown = null

  @mapTo('OperationMode')
  public accessor mode: unknown = null

  @mapTo('SetTemperature')
  public accessor temperature: unknown = null

  @mapTo('VaneVerticalDirection')
  public accessor vertical: unknown = null
}
