import { alias } from '../decorators'
import { flagsErv } from '../types'

import { BaseDeviceFacade } from './base_device'

export class DeviceErvFacade extends BaseDeviceFacade<'Erv'> {
  public readonly flags = flagsErv

  @alias('RoomCO2Level')
  public accessor co2: unknown = undefined

  @alias('SetFanSpeed')
  public accessor fan: unknown = undefined

  @alias('VentilationMode')
  public accessor mode: unknown = undefined

  @alias('OutdoorTemperature')
  public accessor outdoorTemperature: unknown = undefined

  @alias('PM25Level')
  public accessor pm25: unknown = undefined

  @alias('Power')
  public accessor power: unknown = undefined

  @alias('RoomTemperature')
  public accessor temperature: unknown = undefined
}
