import type { NonFlagsKeyOf, SetKeys, UpdateDeviceData } from '../types'
import BaseDeviceFacade from './device'

export default class extends BaseDeviceFacade<'Ata'> {
  protected readonly setDataMapping: Record<
    NonFlagsKeyOf<UpdateDeviceData['Ata']>,
    keyof SetKeys['Ata']
  > = {
    OperationMode: 'mode',
    Power: 'power',
    SetFanSpeed: 'fan',
    SetTemperature: 'temperature',
    VaneHorizontal: 'horizontal',
    VaneVertical: 'vertical',
  }

  protected readonly setKeyMapping: Record<
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
