import { BaseDeviceFacade } from './base-device.ts'

import type { DeviceType } from '../enums.ts'

import type { IDeviceFacade } from './interfaces.ts'

export class DeviceErvFacade
  extends BaseDeviceFacade<DeviceType.Erv>
  implements IDeviceFacade<DeviceType.Erv>
{
  public readonly flags = {
    Power: 0x1,
    SetFanSpeed: 0x8,
    VentilationMode: 0x4,
  } as const

  protected readonly temperatureLegend = [
    undefined,
    'RoomTemperature',
    undefined,
    'OutdoorTemperature',
  ]
}
