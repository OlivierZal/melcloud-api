import BaseDeviceFacade from './device'

export default class extends BaseDeviceFacade<'Ata'> {
  protected setKeys = {
    fan: 'SetFanSpeed',
    horizontal: 'VaneHorizontal',
    mode: 'OperationMode',
    power: 'Power',
    temperature: 'SetTemperature',
    vertical: 'VaneVertical',
  }
}
