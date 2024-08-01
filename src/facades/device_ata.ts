import { type UpdateDeviceDataAta, OperationMode } from '../types'
import BaseDeviceFacade, { alias } from './device'

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

  #getTargetTemperatureRange(operationMode = this.setData.OperationMode): {
    max: number
    min: number
  } {
    switch (operationMode) {
      case OperationMode.auto:
        return {
          max: this.data.MaxTempAutomatic,
          min: this.data.MinTempAutomatic,
        }
      case OperationMode.cool:
      case OperationMode.dry:
        return { max: this.data.MaxTempCoolDry, min: this.data.MinTempCoolDry }
      case OperationMode.heat:
      default:
        return { max: this.data.MaxTempHeat, min: this.data.MinTempHeat }
    }
  }

  #handleTargetTemperature(
    data: Partial<UpdateDeviceDataAta>,
  ): Partial<UpdateDeviceDataAta> {
    const { SetTemperature: value, OperationMode: operationMode } = data
    if (value !== undefined) {
      const { min, max } = this.#getTargetTemperatureRange(operationMode)
      return { SetTemperature: Math.min(Math.max(value, min), max) }
    }
    return {}
  }
}
