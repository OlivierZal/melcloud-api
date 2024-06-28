import BaseDeviceFacade from './device'

export default class extends BaseDeviceFacade<'Erv'> {
  protected setKeys = {
    fan: 'SetFanSpeed',
    mode: 'VentilationMode',
    power: 'Power',
  }
}
