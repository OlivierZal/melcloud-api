import BaseDeviceFacade, { mapTo } from './device'
import { FanSpeed, NUMBER_0 } from '../types'

export default class extends BaseDeviceFacade<'Erv'> {
  @mapTo('SetFanSpeed')
  public accessor fan: unknown = FanSpeed.auto

  @mapTo('VentilationMode')
  public accessor mode: unknown = NUMBER_0
}
