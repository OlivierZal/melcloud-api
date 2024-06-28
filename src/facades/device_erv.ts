import type { NonFlagsKeyOf, SetKeys, UpdateDeviceData } from '../types'
import BaseDeviceFacade from './device'

export default class extends BaseDeviceFacade<'Erv'> {
  protected setKeys: Record<
    keyof SetKeys['Erv'],
    NonFlagsKeyOf<UpdateDeviceData['Erv']>
  > = {
    fan: 'SetFanSpeed',
    mode: 'VentilationMode',
    power: 'Power',
  }
}
