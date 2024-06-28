import type { NonFlagsKeyOf, SetKeys, UpdateDeviceData } from '../types'
import BaseDeviceFacade from './device'

export default class extends BaseDeviceFacade<'Ata'> {
  protected setKeys: Record<
    keyof SetKeys['Ata'],
    NonFlagsKeyOf<UpdateDeviceData['Ata']>
  > = {
    fan: 'SetFanSpeed',
    horizontal: 'VaneHorizontal',
    mode: 'OperationMode',
    power: 'Power',
    temperature: 'SetTemperature',
    vertical: 'VaneVertical',
  }
}
