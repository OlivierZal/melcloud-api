import BaseDeviceFacade, { mapTo } from './device'
import { FanSpeed, VentilationMode } from '../types'

export default class extends BaseDeviceFacade<'Erv'> {
  @mapTo('SetFanSpeed')
  public accessor fan: unknown = FanSpeed.auto

  @mapTo('VentilationMode')
  public accessor mode: unknown = VentilationMode.auto
}
