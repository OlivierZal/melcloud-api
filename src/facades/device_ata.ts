import BaseDeviceFacade, { mapTo } from './device'
import {
  FanSpeed,
  Horizontal,
  NUMBER_0,
  OperationMode,
  Vertical,
} from '../types'

export default class extends BaseDeviceFacade<'Ata'> {
  @mapTo('FanSpeed')
  public accessor fan: unknown = FanSpeed.auto

  @mapTo('VaneHorizontalDirection')
  public accessor horizontal: unknown = Horizontal.auto

  @mapTo('OperationMode')
  public accessor mode: unknown = OperationMode.auto

  @mapTo('SetTemperature')
  public accessor temperature: unknown = NUMBER_0

  @mapTo('VaneVerticalDirection')
  public accessor vertical: unknown = Vertical.auto
}
