import { type UpdateDeviceDataAta, OperationMode, flagsAta } from '../types'
import BaseDeviceFacade, { alias } from './device'

export default class extends BaseDeviceFacade<'Ata'> {
  public readonly flags = flagsAta

  @alias('ActualFanSpeed')
  public accessor actualFan: unknown = undefined

  @alias('FanSpeed')
  public accessor fan: unknown = undefined

  @alias('VaneHorizontalDirection')
  public accessor horizontal: unknown = undefined

  @alias('OperationMode')
  public accessor mode: unknown = undefined

  @alias('OutdoorTemperature')
  public accessor outdoorTemperature: unknown = undefined

  @alias('Power')
  public accessor power: unknown = undefined

  @alias('SetTemperature')
  public accessor targetTemperature: unknown = undefined

  @alias('RoomTemperature')
  public accessor temperature: unknown = undefined

  @alias('VaneVerticalDirection')
  public accessor vertical: unknown = undefined

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

  #handleTargetTemperature(data: Partial<UpdateDeviceDataAta>): {
    SetTemperature?: number
  } {
    const { OperationMode: operationMode, SetTemperature: value } = data
    if (value !== undefined) {
      const { max, min } = this.#getTargetTemperatureRange(operationMode)
      return { SetTemperature: Math.min(Math.max(value, min), max) }
    }
    return {}
  }
}
