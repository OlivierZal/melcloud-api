import BaseDeviceFacade, { mapTo } from './device'
import { OperationMode, type UpdateDeviceDataAta } from '../types'

export default class extends BaseDeviceFacade<'Ata'> {
  @mapTo('ActualFanSpeed')
  public accessor actualFan: unknown = null

  @mapTo('FanSpeed')
  public accessor fan: unknown = null

  @mapTo('VaneHorizontalDirection')
  public accessor horizontal: unknown = null

  @mapTo('OperationMode')
  public accessor mode: unknown = null

  @mapTo('Power')
  public accessor power: unknown = null

  @mapTo('OutdoorTemperature')
  public accessor outdoorTemperature: unknown = null

  @mapTo('SetTemperature')
  public accessor targetTemperature: unknown = null

  @mapTo('RoomTemperature')
  public accessor temperature: unknown = null

  @mapTo('VaneVerticalDirection')
  public accessor vertical: unknown = null

  protected override handle(
    data: Partial<UpdateDeviceDataAta>,
  ): UpdateDeviceDataAta {
    const newData: Partial<UpdateDeviceDataAta> = {}
    const value: number | undefined = data.SetTemperature
    if (typeof value !== 'undefined') {
      switch (this.getRequestedOrCurrentValue(data, 'OperationMode')) {
        case OperationMode.auto:
          newData.SetTemperature = Math.max(value, this.data.MinTempAutomatic)
          break
        case OperationMode.cool:
        case OperationMode.dry:
          newData.SetTemperature = Math.max(value, this.data.MinTempCoolDry)
          break
        case OperationMode.heat:
          newData.SetTemperature = Math.max(value, this.data.MinTempHeat)
          break
        default:
      }
    }
    return super.handle(newData)
  }
}
