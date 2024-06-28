import type { NonFlagsKeyOf, SetKeys, UpdateDeviceData } from '../types'
import BaseDeviceFacade from './device'

export default class extends BaseDeviceFacade<'Erv'> {
  protected readonly setDataMapping: Record<
    NonFlagsKeyOf<UpdateDeviceData['Erv']>,
    keyof SetKeys['Erv']
  > = {
    Power: 'power',
    SetFanSpeed: 'fan',
    VentilationMode: 'mode',
  }

  protected readonly setKeyMapping: Record<
    keyof SetKeys['Erv'],
    NonFlagsKeyOf<UpdateDeviceData['Erv']>
  > = {
    fan: 'SetFanSpeed',
    mode: 'VentilationMode',
    power: 'Power',
  }
}
