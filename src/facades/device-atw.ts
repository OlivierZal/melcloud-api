import { BaseDeviceAtwFacade } from './base-device-atw.ts'

export class DeviceAtwFacade extends BaseDeviceAtwFacade {
  protected readonly temperatureLegend = [
    'SetTemperatureZone1',
    'RoomTemperatureZone1',
    'OutdoorTemperature',
    'TankWaterTemperature',
    'SetTankWaterTemperature',
  ]
}
