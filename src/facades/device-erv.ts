import { BaseDeviceFacade } from './base-device.js'

import type { DeviceType } from '../enums.js'

import type { IDeviceFacade } from './interfaces.js'

export class DeviceErvFacade
  extends BaseDeviceFacade<DeviceType.Erv>
  implements IDeviceFacade<DeviceType.Erv>
{
  public readonly flags = {
    Power: 0x1,
    SetFanSpeed: 0x8,
    VentilationMode: 0x4,
  } as const
}
