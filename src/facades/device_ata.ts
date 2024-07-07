import BaseDeviceFacade, { alias } from './device'
import { OperationMode, type UpdateDeviceDataAta } from '../types'

const MAX_TEMP = 38

export default class extends BaseDeviceFacade<'Ata'> {
  @alias('ActualFanSpeed')
  public accessor actualFan: unknown = null

  @alias('FanSpeed')
  public accessor fan: unknown = null

  @alias('VaneHorizontalDirection')
  public accessor horizontal: unknown = null

  @alias('OperationMode')
  public accessor mode: unknown = null

  @alias('Power')
  public accessor power: unknown = null

  @alias('OutdoorTemperature')
  public accessor outdoorTemperature: unknown = null

  @alias('SetTemperature')
  public accessor targetTemperature: unknown = null

  @alias('RoomTemperature')
  public accessor temperature: unknown = null

  @alias('VaneVerticalDirection')
  public accessor vertical: unknown = null

  protected override handle(
    data: Partial<UpdateDeviceDataAta>,
  ): UpdateDeviceDataAta {
    return super.handle({ ...data, ...this.#handleTargetTemperature(data) })
  }

  #handleTargetTemperature(
    data: Partial<UpdateDeviceDataAta>,
  ): Partial<UpdateDeviceDataAta> {
    const key = 'SetTemperature'
    let value = data[key]
    if (typeof value !== 'undefined') {
      switch (this.getRequestedOrCurrentValue(data, 'OperationMode')) {
        case OperationMode.auto:
          value = Math.max(value, this.data.MinTempAutomatic)
          break
        case OperationMode.cool:
        case OperationMode.dry:
          value = Math.max(value, this.data.MinTempCoolDry)
          break
        case OperationMode.heat:
          value = Math.max(value, this.data.MinTempHeat)
          break
        default:
      }
      return { [key]: Math.min(value, MAX_TEMP) }
    }
    return {}
  }
}
