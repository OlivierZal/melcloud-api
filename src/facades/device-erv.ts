import { BaseDeviceFacade } from './base-device.ts'

import type { DeviceType } from '../enums.ts'

import type { IDeviceFacade } from './interfaces.ts'

export class DeviceErvFacade
  extends BaseDeviceFacade<DeviceType.Erv>
  implements IDeviceFacade<DeviceType.Erv>
{
  protected override readonly temperatureLegend = [
    undefined,
    'RoomTemperature',
    undefined,
    'OutdoorTemperature',
  ]

  public readonly flags = {
    Power: 0x1,
    SetFanSpeed: 0x8,
    VentilationMode: 0x4,
  } as const
}
