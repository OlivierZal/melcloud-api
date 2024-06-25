import BaseDeviceFacade, { mapTo } from './device'

export default class extends BaseDeviceFacade<'Erv'> {
  @mapTo('SetFanSpeed')
  public accessor fan: unknown = null

  @mapTo('Power')
  public accessor power: unknown = null

  @mapTo('VentilationMode')
  public accessor mode: unknown = null
}
